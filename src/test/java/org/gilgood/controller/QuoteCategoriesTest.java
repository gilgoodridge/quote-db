package org.gilgood.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.gilgood.entity.*;
import org.gilgood.repository.*;
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
import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oidcLogin;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:quote_categories;DB_CLOSE_DELAY=-1",
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
class QuoteCategoriesTest {
    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private QuoteRepository quotes;
    @Autowired private AuthorRepository authors;
    @Autowired private ToneRepository tones;
    @Autowired private ThemeRepository themes;
    @Autowired private FormRepository forms;
    @Autowired private SourceRepository sources;

    private Long authorId;
    private List<Long> toneIds;
    private List<Long> themeIds;
    private List<Long> formIds;
    private List<Long> sourceIds;

    @BeforeEach
    void setUp() {
        quotes.deleteAll();
        authors.deleteAll();
        tones.deleteAll();
        themes.deleteAll();
        forms.deleteAll();
        sources.deleteAll();
        Author author = new Author("Category Test Author");
        author.setDateOfBirth(LocalDate.of(1900, 1, 1));
        authorId = authors.saveAndFlush(author).getId();
        toneIds = tones.saveAllAndFlush(List.of(named(new Tone(), "Funny"), named(new Tone(), "Insightful")))
                .stream().map(Tone::getId).toList();
        themeIds = themes.saveAllAndFlush(List.of(named(new Theme(), "Human nature"), named(new Theme(), "Art & beauty")))
                .stream().map(Theme::getId).toList();
        formIds = forms.saveAllAndFlush(List.of(named(new Form(), "Metaphor"), named(new Form(), "Verse")))
                .stream().map(Form::getId).toList();
        sourceIds = sources.saveAllAndFlush(List.of(named(new Source(), "Play"), named(new Source(), "Book")))
                .stream().map(Source::getId).toList();
    }

    @Test
    void catalogIsPublicAndReadOnly() throws Exception {
        mvc.perform(get("/api/categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tones.length()").value(2))
                .andExpect(jsonPath("$.tones[0].id").value(toneIds.getFirst()))
                .andExpect(jsonPath("$.tones[0].name").value("Funny"))
                .andExpect(jsonPath("$.tones[0].description").value("Scope of Funny"))
                .andExpect(jsonPath("$.themes[0].description").value("Scope of Human nature"))
                .andExpect(jsonPath("$.forms[0].description").value("Scope of Metaphor"))
                .andExpect(jsonPath("$.sources[0].description").value("Scope of Play"))
                .andExpect(jsonPath("$.themes[1].name").value("Art & beauty"))
                .andExpect(jsonPath("$.forms[1].name").value("Verse"))
                .andExpect(jsonPath("$.sources[1].name").value("Book"));
        mvc.perform(head("/api/categories")).andExpect(status().isOk());
        mvc.perform(post("/api/categories").with(oidcLogin()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"New\"}"))
                .andExpect(status().isMethodNotAllowed());
    }

    @Test
    void persistsMultipleSelectionsInEveryDimensionAndReturnsDtosOnAllReadPaths() throws Exception {
        JsonNode created = create(categorizedRequest());
        long id = created.path("id").asLong();
        for (String dimension : List.of("tones", "themes", "forms", "sources")) {
            assertEquals(2, created.path(dimension).size());
            assertEquals("Scope of " + created.path(dimension).get(0).path("name").asText(),
                    created.path(dimension).get(0).path("description").asText());
        }
        mvc.perform(get("/api/quotes/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tones[0].id").value(toneIds.getFirst()))
                .andExpect(jsonPath("$.tones[1].name").value("Insightful"))
                .andExpect(jsonPath("$.tones[1].description").value("Scope of Insightful"))
                .andExpect(jsonPath("$.themes.length()").value(2))
                .andExpect(jsonPath("$.forms.length()").value(2))
                .andExpect(jsonPath("$.sources.length()").value(2))
                .andExpect(jsonPath("$.searchText").doesNotExist())
                .andExpect(jsonPath("$.tones[0].quotes").doesNotExist());
        mvc.perform(get("/api/quotes"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].sources.length()").value(2))
                .andExpect(jsonPath("$[0].sources[0].description").value("Scope of Play"));
        mvc.perform(get("/api/quotes").param("authorId", authorId.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].tones.length()").value(2));
    }

    @Test
    void oldClientsCanCreateWithoutAnyCategories() throws Exception {
        JsonNode created = create(baseRequest());
        for (String dimension : List.of("tones", "themes", "forms", "sources")) {
            assertEquals(0, created.path(dimension).size());
        }
    }

    @Test
    void quoteListingFiltersByCategoriesAndCombinesDimensionsWithAnd() throws Exception {
        var toneOnly = baseRequest();
        toneOnly.put("text", "Tone only");
        toneOnly.put("toneIds", List.of(toneIds.getFirst()));
        long toneOnlyId = create(toneOnly).path("id").asLong();

        var toneAndTheme = baseRequest();
        toneAndTheme.put("text", "Tone and theme");
        toneAndTheme.put("toneIds", List.of(toneIds.getLast()));
        toneAndTheme.put("themeIds", List.of(themeIds.getFirst()));
        long toneAndThemeId = create(toneAndTheme).path("id").asLong();

        Author otherAuthor = new Author("Other Category Test Author");
        otherAuthor.setDateOfBirth(LocalDate.of(1901, 1, 1));
        long otherAuthorId = authors.saveAndFlush(otherAuthor).getId();
        var otherAuthorQuote = baseRequest();
        otherAuthorQuote.put("authorId", otherAuthorId);
        otherAuthorQuote.put("text", "Same tone, different author");
        otherAuthorQuote.put("toneIds", List.of(toneIds.getFirst()));
        long otherAuthorQuoteId = create(otherAuthorQuote).path("id").asLong();

        mvc.perform(get("/api/quotes").param("toneIds", toneIds.getFirst().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value(toneOnlyId));
        mvc.perform(get("/api/quotes")
                        .param("toneIds", toneIds.getFirst().toString(), toneIds.getLast().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3));
        mvc.perform(get("/api/quotes")
                        .param("toneIds", toneIds.getLast().toString())
                        .param("themeIds", themeIds.getFirst().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(toneAndThemeId));
        mvc.perform(get("/api/quotes")
                        .param("toneIds", toneIds.getFirst().toString())
                        .param("themeIds", themeIds.getFirst().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());
        mvc.perform(get("/api/quotes")
                        .param("authorId", authorId.toString())
                        .param("toneIds", toneIds.getFirst().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(toneOnlyId));
        mvc.perform(get("/api/quotes")
                        .param("authorId", Long.toString(otherAuthorId))
                        .param("toneIds", toneIds.getFirst().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(otherAuthorQuoteId));
    }

    @ParameterizedTest
    @ValueSource(strings = {"null", "[]"})
    void explicitNullOrEmptySelectionsAreOptionalOnCreate(String value) throws Exception {
        mvc.perform(post("/api/quotes").with(oidcLogin()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"Uncategorized\",\"authorId\":" + authorId
                                + ",\"toneIds\":" + value + ",\"themeIds\":" + value
                                + ",\"formIds\":" + value + ",\"sourceIds\":" + value + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tones").isEmpty())
                .andExpect(jsonPath("$.themes").isEmpty())
                .andExpect(jsonPath("$.forms").isEmpty())
                .andExpect(jsonPath("$.sources").isEmpty());
    }

    @Test
    void replacementReplacesSelectionsAndNullEmptyOrOmittedFieldsClearThem() throws Exception {
        long id = create(categorizedRequest()).path("id").asLong();
        var replacement = baseRequest();
        replacement.put("toneIds", List.of(toneIds.getLast()));
        replacement.put("themeIds", null);
        replacement.put("formIds", List.of());
        mvc.perform(put("/api/quotes/{id}", id).with(oidcLogin()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(replacement)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tones.length()").value(1))
                .andExpect(jsonPath("$.tones[0].name").value("Insightful"))
                .andExpect(jsonPath("$.tones[0].description").value("Scope of Insightful"))
                .andExpect(jsonPath("$.themes").isEmpty())
                .andExpect(jsonPath("$.forms").isEmpty())
                .andExpect(jsonPath("$.sources").isEmpty());
        mvc.perform(get("/api/quotes/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tones.length()").value(1))
                .andExpect(jsonPath("$.sources").isEmpty());
    }

    @Test
    void duplicateIdsAreStoredOnceAndDeletionKeepsCatalogsAndAuthor() throws Exception {
        var request = categorizedRequest();
        request.put("toneIds", List.of(toneIds.getFirst(), toneIds.getFirst()));
        request.put("themeIds", List.of(themeIds.getFirst(), themeIds.getFirst()));
        request.put("formIds", List.of(formIds.getFirst(), formIds.getFirst()));
        request.put("sourceIds", List.of(sourceIds.getFirst(), sourceIds.getFirst()));
        JsonNode created = create(request);
        for (String dimension : List.of("tones", "themes", "forms", "sources")) {
            assertEquals(1, created.path(dimension).size());
        }
        mvc.perform(delete("/api/quotes/{id}", created.path("id").asLong()).with(oidcLogin()).with(csrf()))
                .andExpect(status().isOk());
        assertEquals(0, quotes.count());
        assertEquals(1, authors.count());
        assertEquals(2, tones.count());
        assertEquals(2, themes.count());
        assertEquals(2, forms.count());
        assertEquals(2, sources.count());
    }

    @ParameterizedTest
    @ValueSource(strings = {"toneIds", "themeIds", "formIds", "sourceIds"})
    void rejectsUnknownIdsWithoutCreatingQuoteOrPartiallyUpdatingIt(String field) throws Exception {
        var invalid = categorizedRequest();
        invalid.put(field, List.of(Long.MAX_VALUE));
        mvc.perform(post("/api/quotes").with(oidcLogin()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(invalid)))
                .andExpect(status().isBadRequest())
                .andExpect(content().string(containsString("Unknown " + field)));
        assertEquals(0, quotes.count());
        long id = create(categorizedRequest()).path("id").asLong();
        invalid.put("text", "This change must roll back");
        mvc.perform(put("/api/quotes/{id}", id).with(oidcLogin()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(invalid)))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/quotes/{id}", id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.text").value("A categorized quote"))
                .andExpect(jsonPath("$.tones.length()").value(2))
                .andExpect(jsonPath("$.themes.length()").value(2))
                .andExpect(jsonPath("$.forms.length()").value(2))
                .andExpect(jsonPath("$.sources.length()").value(2));
    }

    @ParameterizedTest
    @ValueSource(strings = {"toneIds", "themeIds", "formIds", "sourceIds"})
    void rejectsNullZeroAndNegativeIdElements(String field) throws Exception {
        for (String value : List.of("null", "0", "-1")) {
            mvc.perform(post("/api/quotes").with(oidcLogin()).with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"text\":\"Invalid\",\"authorId\":" + authorId + ",\"" + field + "\":[" + value + "]}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(content().string(containsString(field + " must contain only positive IDs")));
        }
        assertEquals(0, quotes.count());
    }

    @Test
    void categoryWritesStillRequireSessionAndCsrf() throws Exception {
        String body = json.writeValueAsString(categorizedRequest());
        mvc.perform(post("/api/quotes").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/quotes").with(oidcLogin()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden());
        assertEquals(0, quotes.count());
    }

    private JsonNode create(Map<String, Object> request) throws Exception {
        var result = mvc.perform(post("/api/quotes").with(oidcLogin()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
                .andExpect(status().isOk()).andReturn();
        return json.readTree(result.getResponse().getContentAsString());
    }

    private Map<String, Object> baseRequest() {
        return new java.util.LinkedHashMap<>(Map.of("text", "A categorized quote", "authorId", authorId));
    }

    private Map<String, Object> categorizedRequest() {
        var request = baseRequest();
        request.put("toneIds", toneIds);
        request.put("themeIds", themeIds);
        request.put("formIds", formIds);
        request.put("sourceIds", sourceIds);
        return request;
    }

    private <T extends QuoteCategory> T named(T category, String name) {
        category.setName(name);
        category.setDescription("Scope of " + name);
        return category;
    }
}
