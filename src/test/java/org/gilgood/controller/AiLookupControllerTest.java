package org.gilgood.controller;

import org.gilgood.dto.AiLookupRequest;
import org.gilgood.dto.AiLookupResponse;
import org.gilgood.exception.GlobalExceptionHandler;
import org.gilgood.service.AiLookupService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class AiLookupControllerTest {
    @Mock
    private AiLookupService service;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        mvc = MockMvcBuilders.standaloneSetup(new AiLookupController(service))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
    }

    @Test
    void returnsGenericValueAndDoesNotCache() throws Exception {
        var request = new AiLookupRequest(AiLookupRequest.Type.AUTHOR_DATE_OF_BIRTH,
                new AiLookupRequest.Context("  Jane Austen  "));
        when(service.lookup(request)).thenReturn(new AiLookupResponse(AiLookupResponse.Status.FOUND, "1775-12-16"));
        mvc.perform(post("/api/ai/lookups").contentType(MediaType.APPLICATION_JSON)
                        .content(body("  Jane Austen  ")))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.status").value("FOUND"))
                .andExpect(jsonPath("$.value").value("1775-12-16"))
                .andExpect(jsonPath("$.dateOfBirth").doesNotExist());
        verify(service).lookup(request);
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"type\":null,\"context\":{\"fullName\":\"Jane\"}}",
            "{\"type\":\"AUTHOR_DATE_OF_BIRTH\"}", "{\"type\":\"AUTHOR_DATE_OF_BIRTH\",\"context\":null}",
            "{\"type\":\"AUTHOR_DATE_OF_BIRTH\",\"context\":{}}",
            "{\"type\":\"AUTHOR_DATE_OF_BIRTH\",\"context\":{\"fullName\":null}}",
            "{\"type\":\"AUTHOR_DATE_OF_BIRTH\",\"context\":{\"fullName\":\"  \"}}",
            "{\"type\":\"AUTHOR_PLACE_OF_BIRTH\",\"context\":{\"fullName\":\"Jane\"}}",
            "{\"type\":\"AUTHOR_DATE_OF_DEATH\",\"context\":{\"fullName\":\"  \"}}",
            "{\"type\":\"QUOTE_SOURCE\",\"context\":{\"fullName\":\"Jane\"}}",
            "{\"type\":\"AUTHOR_DATE_OF_BIRTH\",\"context\":{\"fullName\":{}}}",
            "not-json",
            "{\"type\":0,\"context\":{\"fullName\":\"Jane\"}}"})
    void rejectsMissingInvalidAndUnsupportedInputsBeforeCallingProvider(String body) throws Exception {
        mvc.perform(post("/api/ai/lookups").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }

    @Test
    void rejectsOverlongName() throws Exception {
        mvc.perform(post("/api/ai/lookups").contentType(MediaType.APPLICATION_JSON).content(body("a".repeat(256))))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }

    @Test
    void returnsUncertaintyAndExplicitQuotaErrors() throws Exception {
        when(service.lookup(any())).thenReturn(new AiLookupResponse(AiLookupResponse.Status.UNKNOWN, null));
        mvc.perform(post("/api/ai/lookups").contentType(MediaType.APPLICATION_JSON).content(body("Unknown")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UNKNOWN"));
        when(service.lookup(any())).thenThrow(
                new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Gemini quota exceeded"));
        mvc.perform(post("/api/ai/lookups").contentType(MediaType.APPLICATION_JSON).content(body("Unknown")))
                .andExpect(status().isTooManyRequests()).andExpect(content().string("Gemini quota exceeded"));
    }

    private static String body(String fullName) {
        return "{\"type\":\"AUTHOR_DATE_OF_BIRTH\",\"context\":{\"fullName\":\"" + fullName + "\"}}";
    }

    @Test
    void acceptsDeathDateLookupUsingTheSameEndpoint() throws Exception {
        var request = new AiLookupRequest(AiLookupRequest.Type.AUTHOR_DATE_OF_DEATH,
                new AiLookupRequest.Context("Jane Austen"));
        when(service.lookup(request)).thenReturn(new AiLookupResponse(AiLookupResponse.Status.FOUND, "1817-07-18"));
        mvc.perform(post("/api/ai/lookups").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"AUTHOR_DATE_OF_DEATH\",\"context\":{\"fullName\":\"Jane Austen\"}}"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.status").value("FOUND"))
                .andExpect(jsonPath("$.value").value("1817-07-18"));
        verify(service).lookup(request);
    }
}
