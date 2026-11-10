package org.gilgood.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.gilgood.entity.Author;
import org.gilgood.repository.AuthorRepository;
import org.gilgood.repository.CharacterRepository;
import org.gilgood.repository.QuoteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oidcLogin;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:characters;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.flyway.enabled=false",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.open-in-view=false",
        "spring.security.oauth2.client.registration.google.client-id=test-client",
        "spring.security.oauth2.client.registration.google.client-secret=test-secret"
})
@AutoConfigureMockMvc
class CharacterControllerTest {
    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private CharacterRepository characters;
    @Autowired private QuoteRepository quotes;
    @Autowired private AuthorRepository authors;
    private Long authorId;

    @BeforeEach
    void setUp() {
        quotes.deleteAll();
        characters.deleteAll();
        authors.deleteAll();
        Author author = new Author("William Shakespeare");
        author.setDateOfBirth(LocalDate.of(1564, 4, 26));
        authorId = authors.saveAndFlush(author).getId();
    }

    @Test
    void characterCrudUsesDtosAndFullReplacementWithoutAcceptingClientIds() throws Exception {
        var request = new LinkedHashMap<String, Object>(Map.of(
                "id", 999, "fullName", "Hamlet", "knownAs", "Prince Hamlet",
                "description", "Prince of Denmark", "workTitle", "Hamlet"));
        JsonNode created = createCharacter(request);
        long id = created.path("id").asLong();
        assertNotEquals(999, id);
        mvc.perform(get("/api/characters/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("Hamlet"))
                .andExpect(jsonPath("$.knownAs").value("Prince Hamlet"))
                .andExpect(jsonPath("$.description").value("Prince of Denmark"))
                .andExpect(jsonPath("$.workTitle").value("Hamlet"))
                .andExpect(jsonPath("$.quotes").doesNotExist());
        mvc.perform(put("/api/characters/{id}", id).with(oidcLogin()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"id\":999,\"fullName\":\"Prince Hamlet\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.fullName").value("Prince Hamlet"))
                .andExpect(jsonPath("$.knownAs").doesNotExist())
                .andExpect(jsonPath("$.description").doesNotExist())
                .andExpect(jsonPath("$.workTitle").doesNotExist());
        mvc.perform(delete("/api/characters/{id}", id).with(oidcLogin()).with(csrf()))
                .andExpect(status().isOk());
        for (var method : new org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder[]{
                get("/api/characters/{id}", id),
                put("/api/characters/{id}", id).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Missing\"}"),
                delete("/api/characters/{id}", id)}) {
            mvc.perform(method.with(oidcLogin()).with(csrf())).andExpect(status().isNotFound());
        }
    }

    @Test
    void listsAndSearchesFullNameOnlyWithDatabasePaginationAndLiteralWildcards() throws Exception {
        long first = createCharacter(Map.of("fullName", "Hamlet", "knownAs", "Prince")).path("id").asLong();
        long second = createCharacter(Map.of("fullName", "Young Hamlet")).path("id").asLong();
        createCharacter(Map.of("fullName", "Someone else", "knownAs", "Hamlet",
                "description", "Hamlet", "workTitle", "Hamlet"));
        for (String query : new String[]{"", "  "}) {
            mvc.perform(get("/api/characters").param("query", query).param("size", "2"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[0].id").value(first))
                    .andExpect(jsonPath("$.page.totalElements").value(3))
                    .andExpect(jsonPath("$.page.totalPages").value(2));
        }
        mvc.perform(get("/api/characters").param("query", "  hAMLet  ")
                        .param("page", "1").param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].id").value(second))
                .andExpect(jsonPath("$.page.totalElements").value(2));
        mvc.perform(get("/api/characters").param("query", "Hamlet").param("page", "2").param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isEmpty())
                .andExpect(jsonPath("$.page.totalElements").value(2));
        for (String literal : new String[]{"%", "_", "\\"}) {
            long id = createCharacter(Map.of("fullName", "Literal " + literal)).path("id").asLong();
            mvc.perform(get("/api/characters").param("query", literal))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content.length()").value(1))
                    .andExpect(jsonPath("$.content[0].id").value(id));
        }
        mvc.perform(get("/api/characters").param("query", "unmatched"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isEmpty())
                .andExpect(jsonPath("$.page.totalElements").value(0));
        mvc.perform(get("/api/characters"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page.size").value(20));
        mvc.perform(head("/api/characters")).andExpect(status().isOk());
        mvc.perform(head("/api/characters/{id}", first)).andExpect(status().isOk());
    }

    @Test
    void rejectsInvalidFieldsAndPagination() throws Exception {
        long id = createCharacter(Map.of("fullName", "Hamlet", "knownAs", " ")).path("id").asLong();
        assertNull(characters.findById(id).orElseThrow().getKnownAs());
        for (var invalid : new String[]{"{}", "{\"fullName\":null}", "{\"fullName\":\"  \"}",
                json.writeValueAsString(Map.of("fullName", "x".repeat(256))),
                json.writeValueAsString(Map.of("fullName", "Hamlet", "knownAs", "x".repeat(256))),
                json.writeValueAsString(Map.of("fullName", "Hamlet", "description", "x".repeat(1025))),
                json.writeValueAsString(Map.of("fullName", "Hamlet", "workTitle", "x".repeat(256)))}) {
            mvc.perform(post("/api/characters").with(oidcLogin()).with(csrf())
                            .contentType(MediaType.APPLICATION_JSON).content(invalid))
                    .andExpect(status().isBadRequest());
            mvc.perform(put("/api/characters/{id}", id).with(oidcLogin()).with(csrf())
                            .contentType(MediaType.APPLICATION_JSON).content(invalid))
                    .andExpect(status().isBadRequest());
        }
        assertEquals("Hamlet", characters.findById(id).orElseThrow().getFullName());
        for (String page : new String[]{"-1", "no", "1.5", "2147483648"}) {
            mvc.perform(get("/api/characters").param("page", page)).andExpect(status().isBadRequest());
        }
        for (String size : new String[]{"0", "-1", "101", "no"}) {
            mvc.perform(get("/api/characters").param("size", size)).andExpect(status().isBadRequest());
        }
        mvc.perform(get("/api/characters").param("page", "2147483647").param("size", "100"))
                .andExpect(status().isBadRequest());
    }

    @ParameterizedTest
    @ValueSource(strings = {"POST", "PUT", "DELETE"})
    void characterWritesRequireAuthenticationAndCsrf(String method) throws Exception {
        long id = createCharacter(Map.of("fullName", "Hamlet")).path("id").asLong();
        String path = method.equals("POST") ? "/api/characters" : "/api/characters/" + id;
        var request = request(org.springframework.http.HttpMethod.valueOf(method), path)
                .contentType(MediaType.APPLICATION_JSON).content("{\"fullName\":\"Hamlet\"}");
        mvc.perform(request.with(csrf())).andExpect(status().isUnauthorized());
        mvc.perform(request(org.springframework.http.HttpMethod.valueOf(method), path).with(oidcLogin())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"fullName\":\"Hamlet\"}"))
                .andExpect(status().isForbidden());
        assertEquals(1, characters.count());
    }

    @Test
    void quotesKeepAuthorsAndExposeOptionalCharacterOnEveryReadPath() throws Exception {
        long characterId = createCharacter(Map.of("fullName", "Hamlet", "workTitle", "Hamlet")).path("id").asLong();
        var request = quoteRequest();
        JsonNode narrator = createQuote(request);
        assertFalse(narrator.hasNonNull("character"));
        request.put("characterId", characterId);
        long id = createQuote(request).path("id").asLong();
        for (var read : Map.of(
                "/api/quotes/" + id, "$",
                "/api/quotes", "$.content[1]",
                "/api/quotes?authorId=" + authorId, "$.content[1]").entrySet()) {
            String prefix = read.getValue();
            mvc.perform(get(read.getKey()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath(prefix + ".author.id").value(authorId))
                    .andExpect(jsonPath(prefix + ".character.id").value(characterId))
                    .andExpect(jsonPath(prefix + ".character.fullName").value("Hamlet"))
                    .andExpect(jsonPath(prefix + ".character.workTitle").value("Hamlet"))
                    .andExpect(jsonPath(prefix + ".character.quotes").doesNotExist());
        }
        request.remove("authorId");
        mvc.perform(post("/api/quotes").with(oidcLogin()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/quotes/{id}", id).with(oidcLogin()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
        assertEquals(2, quotes.count());
        mvc.perform(delete("/api/quotes/{id}", id).with(oidcLogin()).with(csrf()))
                .andExpect(status().isOk());
        assertTrue(characters.existsById(characterId));
        assertTrue(authors.existsById(authorId));
    }

    @Test
    void quoteReplacementChangesAndClearsCharacterAndInvalidWritesAreAtomic() throws Exception {
        long first = createCharacter(Map.of("fullName", "Hamlet")).path("id").asLong();
        long second = createCharacter(Map.of("fullName", "Ophelia")).path("id").asLong();
        var request = quoteRequest();
        request.put("characterId", first);
        long id = createQuote(request).path("id").asLong();
        for (long invalid : new long[]{0, -1, Long.MAX_VALUE}) {
            request.put("characterId", invalid);
            request.put("text", "Must not be saved");
            mvc.perform(post("/api/quotes").with(oidcLogin()).with(csrf())
                            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
                    .andExpect(status().isBadRequest())
                    .andExpect(content().string(containsString("characterId")));
            mvc.perform(put("/api/quotes/{id}", id).with(oidcLogin()).with(csrf())
                            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
                    .andExpect(status().isBadRequest());
            mvc.perform(get("/api/quotes/{id}", id)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.text").value("To be, or not to be"))
                    .andExpect(jsonPath("$.character.id").value(first));
        }
        assertEquals(1, quotes.count());
        request.put("characterId", second);
        replaceQuote(id, request).andExpect(jsonPath("$.character.id").value(second));
        request.put("characterId", null);
        replaceQuote(id, request).andExpect(jsonPath("$.character").doesNotExist());
        request.put("characterId", first);
        replaceQuote(id, request).andExpect(jsonPath("$.character.id").value(first));
        request.remove("characterId");
        replaceQuote(id, request).andExpect(jsonPath("$.character").doesNotExist());
    }

    @Test
    void linkedCharacterDeletionReturnsConflictAndPreservesQuoteUntilUnlinked() throws Exception {
        long characterId = createCharacter(Map.of("fullName", "Hamlet")).path("id").asLong();
        var request = quoteRequest();
        request.put("characterId", characterId);
        long quoteId = createQuote(request).path("id").asLong();
        mvc.perform(delete("/api/characters/{id}", characterId).with(oidcLogin()).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(content().string(containsString("linked to quotes")));
        mvc.perform(get("/api/quotes/{id}", quoteId)).andExpect(status().isOk())
                .andExpect(jsonPath("$.character.id").value(characterId))
                .andExpect(jsonPath("$.author.id").value(authorId));
        request.remove("characterId");
        replaceQuote(quoteId, request);
        mvc.perform(delete("/api/characters/{id}", characterId).with(oidcLogin()).with(csrf()))
                .andExpect(status().isOk());
        assertTrue(quotes.existsById(quoteId));
        assertTrue(authors.existsById(authorId));
    }

    private JsonNode createCharacter(Map<String, Object> request) throws Exception {
        return json.readTree(mvc.perform(post("/api/characters").with(oidcLogin()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private JsonNode createQuote(Map<String, Object> request) throws Exception {
        return json.readTree(mvc.perform(post("/api/quotes").with(oidcLogin()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private org.springframework.test.web.servlet.ResultActions replaceQuote(long id, Map<String, Object> request)
            throws Exception {
        return mvc.perform(put("/api/quotes/{id}", id).with(oidcLogin()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
                .andExpect(status().isOk());
    }

    private Map<String, Object> quoteRequest() {
        return new LinkedHashMap<>(Map.of("text", "To be, or not to be", "authorId", authorId));
    }
}
