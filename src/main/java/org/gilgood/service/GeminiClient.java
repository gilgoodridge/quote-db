package org.gilgood.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.Map;

@Service
public class GeminiClient {
    private final RestClient client;
    private final String apiKey;
    private final String model;

    @Autowired
    public GeminiClient(RestClient.Builder builder,
                        @Value("${app.gemini.api-key}") String apiKey,
                        @Value("${app.gemini.model}") String model) {
        this(builder.requestFactory(requestFactory())
                .baseUrl("https://generativelanguage.googleapis.com").build(), apiKey, model);
    }

    GeminiClient(RestClient client, String apiKey, String model) {
        this.client = client;
        this.apiKey = apiKey;
        this.model = model;
    }

    private static JdkClientHttpRequestFactory requestFactory() {
        var factory = new JdkClientHttpRequestFactory(HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10)).build());
        factory.setReadTimeout(Duration.ofSeconds(30));
        return factory;
    }

    public String generate(String instruction, String context) {
        if (apiKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Gemini AI lookup is not configured. Set GEMINI_API_KEY on the backend.");
        }
        JsonNode response;
        try {
            response = client.post().uri("/v1beta/models/{model}:generateContent", model)
                    .header("x-goog-api-key", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "systemInstruction", Map.of("parts", List.of(Map.of("text", instruction))),
                            "contents", List.of(Map.of("role", "user", "parts", List.of(Map.of("text", context)))),
                            "generationConfig", Map.of("candidateCount", 1, "maxOutputTokens", 2048)))
                    .retrieve().body(JsonNode.class);
        } catch (RestClientResponseException ex) {
            int status = ex.getStatusCode().value();
            // Do not expose provider response bodies: they may contain credentials or request details.
            String message = switch (status) {
                case 400 -> "Gemini rejected the lookup request. Check the backend API key and model configuration.";
                case 401, 403 -> "Gemini rejected the backend API key or its permissions.";
                case 404 -> "The configured Gemini model is unavailable. Check GEMINI_MODEL on the backend.";
                case 429 -> "Gemini quota or rate limit exceeded. Check your API allowance and try again later.";
                default -> "Gemini lookup failed (provider HTTP " + status + "). Try again later.";
            };
            throw new ResponseStatusException(status == 429 ? HttpStatus.TOO_MANY_REQUESTS : HttpStatus.BAD_GATEWAY,
                    message);
        } catch (ResourceAccessException ex) {
            throw new ResponseStatusException(HttpStatus.GATEWAY_TIMEOUT,
                    "Gemini could not be reached or the lookup timed out. Try again.");
        } catch (RestClientException ex) {
            throw invalidResponse();
        }
        var candidates = response == null ? null : response.path("candidates");
        if (candidates == null || !candidates.isArray() || candidates.size() != 1) {
            throw invalidResponse();
        }
        var candidate = candidates.get(0);
        if (!"STOP".equals(candidate.path("finishReason").asText())) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Gemini blocked or did not complete the lookup. Try again.");
        }
        var text = new StringBuilder();
        for (var part : candidate.path("content").path("parts")) {
            if (!part.path("thought").asBoolean(false) && part.path("text").isTextual()) {
                text.append(part.path("text").asText());
            }
        }
        String answer = text.toString().trim();
        if (answer.isEmpty()) throw invalidResponse();
        return answer;
    }

    private static ResponseStatusException invalidResponse() {
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                "Gemini returned an invalid lookup response. No fields were changed; try again or enter the value manually.");
    }
}
