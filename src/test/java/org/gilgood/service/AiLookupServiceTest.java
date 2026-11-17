package org.gilgood.service;

import org.gilgood.dto.AiLookupRequest;
import org.gilgood.dto.AiLookupResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.net.SocketTimeoutException;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class AiLookupServiceTest {
    private MockRestServiceServer server;
    private AiLookupService service;

    @BeforeEach
    void setUp() {
        var builder = RestClient.builder().baseUrl("https://generativelanguage.googleapis.com");
        server = MockRestServiceServer.bindTo(builder).build();
        service = new AiLookupService(new GeminiClient(builder.build(), "test-key", "gemini-3.5-flash-lite"));
    }

    @Test
    void sendsNameSeparatelyFromInstructionsAndParsesStrictDate() {
        server.expect(requestTo("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("x-goog-api-key", "test-key"))
                .andExpect(jsonPath("$.contents[0].parts[0].text").value("Jane Austen"))
                .andExpect(jsonPath("$.systemInstruction.parts[0].text").value(
                        org.hamcrest.Matchers.containsString("99.9%")))
                .andRespond(withSuccess(answer("12/16/1775"), MediaType.APPLICATION_JSON));
        var response = service.lookup(request("  Jane Austen  "));
        assertEquals(AiLookupResponse.Status.FOUND, response.status());
        assertEquals("1775-12-16", response.value());
        server.verify();
    }

    @Test
    void idkIsUncertaintyNotAnError() {
        server.expect(anything()).andRespond(withSuccess(answer(" IDK\n"), MediaType.APPLICATION_JSON));
        var response = service.lookup(request("Unknown Author"));
        assertEquals(AiLookupResponse.Status.UNKNOWN, response.status());
        assertNull(response.value());
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(strings = {"02/29/1900", "13/01/2000", "01/01/0000", "01/01/2999",
            "1775-12-16", "12/1775", "I think 12/16/1775", "\"12/16/1775\""})
    void invalidDatesAreVisibleErrors(String answer) {
        server.expect(anything()).andRespond(withSuccess(answer(answer), MediaType.APPLICATION_JSON));
        var ex = assertThrows(ResponseStatusException.class, () -> service.lookup(request("An Author")));
        assertEquals(HttpStatus.BAD_GATEWAY, ex.getStatusCode());
        assertTrue(ex.getReason().contains("invalid birth-date response"));
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "null", "not-json",
            "{\"candidates\":[{\"finishReason\":\"STOP\",\"content\":{\"parts\":[{\"text\":\"  \"}]}}]}",
            "{\"promptFeedback\":{\"blockReason\":\"SAFETY\"}}",
            "{\"candidates\":[{\"finishReason\":\"MAX_TOKENS\"}]}",
            "{\"candidates\":[{\"finishReason\":\"STOP\",\"content\":{\"parts\":[]}}]}"})
    void malformedBlockedOrTruncatedResponsesAreNotUncertainty(String body) {
        server.expect(anything()).andRespond(withSuccess(body, MediaType.APPLICATION_JSON));
        assertEquals(HttpStatus.BAD_GATEWAY,
                assertThrows(ResponseStatusException.class, () -> service.lookup(request("An Author"))).getStatusCode());
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(ints = {400, 401, 403, 404, 429, 500, 503})
    void providerErrorsAreVisibleButNeverExposeProviderBodies(int status) {
        server.expect(anything()).andRespond(withStatus(HttpStatus.valueOf(status))
                .body("sensitive provider details test-key"));
        var ex = assertThrows(ResponseStatusException.class, () -> service.lookup(request("An Author")));
        assertEquals(status == 429 ? HttpStatus.TOO_MANY_REQUESTS : HttpStatus.BAD_GATEWAY, ex.getStatusCode());
        assertFalse(ex.getReason().contains("test-key"));
        assertFalse(ex.getReason().contains("sensitive"));
        if (status == 429) assertTrue(ex.getReason().contains("quota or rate limit"));
        server.verify();
    }

    @Test
    void networkFailuresAreVisibleAndNotRetried() {
        server.expect(anything()).andRespond(withException(new SocketTimeoutException("private details")));
        var ex = assertThrows(ResponseStatusException.class, () -> service.lookup(request("An Author")));
        assertEquals(HttpStatus.GATEWAY_TIMEOUT, ex.getStatusCode());
        assertTrue(ex.getReason().contains("timed out"));
        server.verify();
    }

    @Test
    void missingKeyDoesNotCallGoogle() {
        var unconfigured = new AiLookupService(new GeminiClient(RestClient.create(), "", "gemini-3.5-flash-lite"));
        var ex = assertThrows(ResponseStatusException.class, () -> unconfigured.lookup(request("Jane Austen")));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, ex.getStatusCode());
        assertTrue(ex.getReason().contains("GEMINI_API_KEY"));
        server.verify();
    }

    @Test
    void deathDateUsesItsOwnPromptAndStrictIsoNormalization() {
        server.expect(anything())
                .andExpect(jsonPath("$.contents[0].parts[0].text").value("Jane Austen"))
                .andExpect(jsonPath("$.systemInstruction.parts[0].text").value(
                        org.hamcrest.Matchers.allOf(
                                org.hamcrest.Matchers.containsString("exact date of death"),
                                org.hamcrest.Matchers.containsString("99.9%"),
                                org.hamcrest.Matchers.containsString("person is alive"),
                                org.hamcrest.Matchers.containsString("burial date"))))
                .andRespond(withSuccess(answer("07/18/1817"), MediaType.APPLICATION_JSON));
        var response = service.lookup(new AiLookupRequest(AiLookupRequest.Type.AUTHOR_DATE_OF_DEATH,
                new AiLookupRequest.Context("  Jane Austen  ")));
        assertEquals(AiLookupResponse.Status.FOUND, response.status());
        assertEquals("1817-07-18", response.value());
        server.verify();
    }

    @ParameterizedTest
    @EnumSource(AiLookupRequest.Type.class)
    void allLookupTypesPreserveUncertainty(AiLookupRequest.Type type) {
        server.expect(anything()).andRespond(withSuccess(answer("IDK"), MediaType.APPLICATION_JSON));
        var response = service.lookup(new AiLookupRequest(type, new AiLookupRequest.Context("Living or Unknown Author")));
        assertEquals(AiLookupResponse.Status.UNKNOWN, response.status());
        assertNull(response.value());
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(strings = {"02/29/1900", "13/01/2000", "01/01/0000", "01/01/2999",
            "1817-07-18", "07/1817", "I think 07/18/1817", "\"07/18/1817\""})
    void deathDatesUseTheSameStrictValidation(String text) {
        server.expect(anything()).andRespond(withSuccess(answer(text), MediaType.APPLICATION_JSON));
        var request = new AiLookupRequest(AiLookupRequest.Type.AUTHOR_DATE_OF_DEATH,
                new AiLookupRequest.Context("An Author"));
        var ex = assertThrows(ResponseStatusException.class, () -> service.lookup(request));
        assertEquals(HttpStatus.BAD_GATEWAY, ex.getStatusCode());
        assertTrue(ex.getReason().contains("invalid death-date response"));
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(strings = {"Steventon, Hampshire, England, United Kingdom",
            "Steventon, United Kingdom", "Steventon", "Hampshire, England, United Kingdom", "United Kingdom"})
    void birthplacePromptAllowsConfidentPartialLocations(String location) {
        server.expect(anything())
                .andExpect(jsonPath("$.contents[0].parts[0].text").value("Jane Austen"))
                .andExpect(jsonPath("$.systemInstruction.parts[0].text").value(
                        org.hamcrest.Matchers.allOf(
                                org.hamcrest.Matchers.containsString("at least 99% confidence"),
                                org.hamcrest.Matchers.containsString("city/town, administrative divisions, country"),
                                org.hamcrest.Matchers.containsString("any component, just return the components you are 99% confident about"),
                                org.hamcrest.Matchers.containsString("If unsure about the entire place of birth, return exactly \"IDK\""),
                                org.hamcrest.Matchers.containsString("If the person's identity is ambiguous, return exactly \"IDK\""),
                                org.hamcrest.Matchers.containsString("Never return a more specific location than the city or town of birth."))))
                .andRespond(withSuccess(answer(location), MediaType.APPLICATION_JSON));
        var response = service.lookup(new AiLookupRequest(AiLookupRequest.Type.AUTHOR_PLACE_OF_BIRTH,
                new AiLookupRequest.Context("  Jane Austen  ")));
        assertEquals(AiLookupResponse.Status.FOUND, response.status());
        assertEquals(location, response.value());
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "An English playwright, poet, and actor, widely regarded as a leading dramatist.",
            "An English novelist known for social observation and irony.",
            "An English novelist known for social observation and irony. Her fiction explores class and marriage.",
            "An English novelist known for social observation and irony. Her fiction explores class and marriage. Her work remains widely studied."})
    void biographyPromptIncludesEditorialRulesAndAcceptsUpToThreeSentences(String biography) {
        server.expect(anything())
                .andExpect(jsonPath("$.contents[0].parts[0].text").value("Jane Austen"))
                .andExpect(jsonPath("$.systemInstruction.parts[0].text").value(
                        org.hamcrest.Matchers.allOf(
                                org.hamcrest.Matchers.containsString("factual biography"),
                                org.hamcrest.Matchers.containsString("professional, neutral"),
                                org.hamcrest.Matchers.containsString("Leave out controversies"),
                                org.hamcrest.Matchers.containsString("three or fewer sentences in one paragraph"),
                                org.hamcrest.Matchers.containsString("encyclopedia-style opening may be a sentence fragment"),
                                org.hamcrest.Matchers.containsString("use a fragment or a natural complete sentence instead"),
                                org.hamcrest.Matchers.containsString("Do not include the person's name"),
                                org.hamcrest.Matchers.containsString("pen names, aliases"),
                                org.hamcrest.Matchers.containsString("birth date or birth year"),
                                org.hamcrest.Matchers.containsString("death date or death year"),
                                org.hamcrest.Matchers.containsString("place of birth"))))
                .andRespond(withSuccess(answer(biography), MediaType.APPLICATION_JSON));
        var response = service.lookup(new AiLookupRequest(AiLookupRequest.Type.AUTHOR_BIOGRAPHY,
                new AiLookupRequest.Context("Jane Austen")));
        assertEquals(AiLookupResponse.Status.FOUND, response.status());
        assertEquals(biography, response.value());
        server.verify();
    }

    @ParameterizedTest
    @ValueSource(strings = {"One sentence. Two sentences. Three sentences. Four sentences.",
            "An English novelist.\nA second paragraph.", "An English novelist.\r\nA second paragraph.",
            "An English novelist.\u2029A second paragraph."})
    void invalidBiographyStructureIsAnErrorNotTruncatedOrSaved(String biography) {
        server.expect(anything()).andRespond(withSuccess(answer(biography), MediaType.APPLICATION_JSON));
        var request = new AiLookupRequest(AiLookupRequest.Type.AUTHOR_BIOGRAPHY,
                new AiLookupRequest.Context("Jane Austen"));
        var ex = assertThrows(ResponseStatusException.class, () -> service.lookup(request));
        assertEquals(HttpStatus.BAD_GATEWAY, ex.getStatusCode());
        assertTrue(ex.getReason().contains("invalid biography response"));
        server.verify();
    }

    @ParameterizedTest
    @EnumSource(value = AiLookupRequest.Type.class, names = {"AUTHOR_PLACE_OF_BIRTH", "AUTHOR_BIOGRAPHY"})
    void textResultsRespectExistingFieldLengthLimits(AiLookupRequest.Type type) {
        int maxLength = type == AiLookupRequest.Type.AUTHOR_PLACE_OF_BIRTH ? 255 : 1024;
        server.expect(anything()).andRespond(withSuccess(answer("a".repeat(maxLength)), MediaType.APPLICATION_JSON));
        server.expect(anything()).andRespond(withSuccess(answer("a".repeat(maxLength + 1)), MediaType.APPLICATION_JSON));
        var request = new AiLookupRequest(type, new AiLookupRequest.Context("An Author"));
        assertEquals(maxLength, service.lookup(request).value().length());
        var ex = assertThrows(ResponseStatusException.class, () -> service.lookup(request));
        assertEquals(HttpStatus.BAD_GATEWAY, ex.getStatusCode());
        server.verify();
    }

    @ParameterizedTest
    @EnumSource(AiLookupRequest.Type.class)
    void quotaErrorsAreVisibleForEveryLookupType(AiLookupRequest.Type type) {
        server.expect(anything()).andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS).body("private provider details"));
        var request = new AiLookupRequest(type, new AiLookupRequest.Context("An Author"));
        var ex = assertThrows(ResponseStatusException.class, () -> service.lookup(request));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, ex.getStatusCode());
        assertTrue(ex.getReason().contains("quota or rate limit"));
        assertFalse(ex.getReason().contains("private provider details"));
        server.verify();
    }

    @ParameterizedTest
    @EnumSource(AiLookupRequest.Type.class)
    void promptsDescribePeopleWithoutAssumingTheyAreAuthors(AiLookupRequest.Type type) {
        String result = switch (type) {
            case AUTHOR_DATE_OF_BIRTH -> "11/30/1874";
            case AUTHOR_DATE_OF_DEATH -> "01/24/1965";
            case AUTHOR_PLACE_OF_BIRTH -> "Woodstock, Oxfordshire, England, United Kingdom";
            case AUTHOR_BIOGRAPHY -> "A British statesman who served as prime minister and led the country during the Second World War.";
        };
        server.expect(anything())
                .andExpect(jsonPath("$.contents[0].parts[0].text").value("Winston Churchill"))
                .andExpect(jsonPath("$.systemInstruction.parts[0].text").value(
                        org.hamcrest.Matchers.allOf(
                                org.hamcrest.Matchers.containsString("person named in the user message"),
                                org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsStringIgnoringCase("author")))))
                .andExpect(jsonPath("$.systemInstruction.parts[0].text").value(
                        type == AiLookupRequest.Type.AUTHOR_BIOGRAPHY
                                ? org.hamcrest.Matchers.allOf(
                                        org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("IDK")),
                                        org.hamcrest.Matchers.containsString("Do your best using the reliable facts"),
                                        org.hamcrest.Matchers.containsString("whatever their profession"))
                                : org.hamcrest.Matchers.containsString("IDK")))
                .andRespond(withSuccess(answer(result), MediaType.APPLICATION_JSON));
        var response = service.lookup(new AiLookupRequest(type, new AiLookupRequest.Context("Winston Churchill")));
        assertEquals(AiLookupResponse.Status.FOUND, response.status());
        if (type == AiLookupRequest.Type.AUTHOR_BIOGRAPHY) assertEquals(result, response.value());
        server.verify();
    }

    private static String answer(String text) {
        var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        var root = mapper.createObjectNode();
        var candidate = root.putArray("candidates").addObject();
        candidate.put("finishReason", "STOP");
        candidate.putObject("content").putArray("parts").addObject().put("text", text);
        return root.toString();
    }

    private static AiLookupRequest request(String fullName) {
        return new AiLookupRequest(AiLookupRequest.Type.AUTHOR_DATE_OF_BIRTH, new AiLookupRequest.Context(fullName));
    }
}
