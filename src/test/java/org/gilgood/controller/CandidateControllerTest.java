package org.gilgood.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.gilgood.entity.Author;
import org.gilgood.entity.Quote;
import org.gilgood.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oidcLogin;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:candidates;DB_CLOSE_DELAY=-1",
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
class CandidateControllerTest {
    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private CandidateAuthorRepository candidateAuthors;
    @Autowired private CandidateQuoteRepository candidateQuotes;
    @Autowired private AuthorRepository authors;
    @Autowired private QuoteRepository quotes;
    @Autowired private JdbcTemplate jdbc;

    @BeforeEach
    void clean() {
        candidateQuotes.deleteAll();
        candidateAuthors.deleteAll();
        quotes.deleteAll();
        authors.deleteAll();
    }

    @Test
    void importsAtomicBatchesWithStableKeysOrderedDtosAndExistingParents() throws Exception {
        var a = author("enwikiquote:batch");
        var q = batchQuote("enwikiquote:batch:q", "enwikiquote:batch");
        var batch = Map.of("authors", List.of(a), "quotes", List.of(q, q));
        var first = postJson("/api/candidates/batch", batch);
        assertEquals(1, first.path("authors").size());
        assertEquals(2, first.path("quotes").size());
        assertEquals(first.path("quotes").get(0), first.path("quotes").get(1));
        long authorId = first.path("authors").get(0).path("id").asLong();
        long quoteId = first.path("quotes").get(0).path("id").asLong();
        assertEquals(authorId, first.path("quotes").get(0).path("candidateAuthorId").asLong());
        assertEquals("** Book, page 42.", first.path("quotes").get(0).path("sourceNotes").asText());
        assertFalse(first.path("quotes").get(0).has("candidateAuthor"));
        var additional = postJson("/api/candidates/batch", Map.of("authors", List.of(),
                "quotes", List.of(batchQuote("enwikiquote:second:q", "enwikiquote:batch"),
                        batchQuote("enwikiquote:third:q", "enwikiquote:batch"))));
        assertEquals("enwikiquote:second:q", additional.path("quotes").get(0).path("importKey").asText());
        assertEquals("enwikiquote:third:q", additional.path("quotes").get(1).path("importKey").asText());
        mvc.perform(put("/api/candidate-authors/{id}", authorId).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Edited author\",\"status\":\"REJECTED\"}"))
                .andExpect(status().isOk());
        mvc.perform(put("/api/candidate-quotes/{id}", quoteId).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"Edited quote\",\"status\":\"REJECTED\"}"))
                .andExpect(status().isOk());
        a.put("sourceRevisionId", 9000000);
        q.put("rawWikitext", "Changed raw text");
        var retry = postJson("/api/candidates/batch", batch);
        assertEquals("Edited author", retry.path("authors").get(0).path("fullName").asText());
        assertEquals("REJECTED", retry.path("authors").get(0).path("status").asText());
        assertEquals(4021123, retry.path("authors").get(0).path("sourceRevisionId").asLong());
        assertEquals("Edited quote", retry.path("quotes").get(0).path("text").asText());
        assertEquals("REJECTED", retry.path("quotes").get(0).path("status").asText());
        assertEquals("* ''Original quotation.''", retry.path("quotes").get(0).path("rawWikitext").asText());
        assertEquals(1, candidateAuthors.count());
        assertEquals(3, candidateQuotes.count());
        assertEquals(0, authors.count());
        assertEquals(0, quotes.count());
    }

    @Test
    void rollsBackWholeBatchForMissingParentAndIdentityConflicts() throws Exception {
        postJson("/api/candidates/batch", Map.of("authors", List.of(author("enwikiquote:existing")),
                "quotes", List.of(batchQuote("enwikiquote:existing:q", "enwikiquote:existing"))));
        for (String failure : List.of("missing-parent", "quote-parent", "quote-page", "author-page")) {
            var a = author("enwikiquote:new");
            var bad = batchQuote("enwikiquote:bad", "enwikiquote:missing");
            int status = 409;
            switch (failure) {
                case "missing-parent" -> status = 400;
                case "quote-parent" -> bad = batchQuote("enwikiquote:existing:q", "enwikiquote:new");
                case "quote-page" -> {
                    bad = batchQuote("enwikiquote:existing:q", "enwikiquote:existing");
                    bad.put("sourcePageId", 99);
                }
                case "author-page" -> {
                    a = author("enwikiquote:existing");
                    a.put("sourcePageId", 99);
                }
            }
            assertPostStatus("/api/candidates/batch", Map.of(
                    "authors", List.of(author("enwikiquote:before"), a),
                    "quotes", List.of(batchQuote("enwikiquote:before:q", "enwikiquote:before"), bad)), status);
            assertEquals(1, candidateAuthors.count(), failure);
            assertEquals(1, candidateQuotes.count(), failure);
        }
    }

    @Test
    void validatesBatchBoundsNestedFieldsAndCsrf() throws Exception {
        var a = author("enwikiquote:batch");
        var q = batchQuote("enwikiquote:batch:q", "enwikiquote:batch");
        for (Object invalid : List.of(
                Map.of(), Map.of("authors", List.of()), Map.of("authors", List.of(), "quotes", List.of()),
                Map.of("authors", java.util.Collections.nCopies(101, a), "quotes", List.of()),
                Map.of("authors", List.of(a), "quotes", java.util.Collections.nCopies(101, q)),
                Map.of("authors", java.util.Arrays.asList((Object) null), "quotes", List.of()),
                Map.of("authors", List.of(a), "quotes", java.util.Arrays.asList((Object) null)))) {
            assertPostStatus("/api/candidates/batch", invalid, 400);
        }
        for (var field : Map.of("candidateAuthorImportKey", "BAD KEY", "text", "",
                "rawWikitext", "x".repeat(16001), "sourceUrl", "javascript:alert(1)").entrySet()) {
            var bad = batchQuote("enwikiquote:batch:q", "enwikiquote:batch");
            bad.put(field.getKey(), field.getValue());
            assertPostStatus("/api/candidates/batch",
                    Map.of("authors", List.of(a), "quotes", List.of(bad)), 400);
        }
        var badAuthor = author("enwikiquote:bad");
        badAuthor.put("fullName", "");
        assertPostStatus("/api/candidates/batch",
                Map.of("authors", List.of(badAuthor), "quotes", List.of()), 400);
        mvc.perform(post("/api/candidates/batch").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("authors", List.of(a), "quotes", List.of(q)))))
                .andExpect(status().isForbidden());
        assertEquals(0, candidateAuthors.count());
        assertEquals(0, candidateQuotes.count());
        var maximum = postJson("/api/candidates/batch",
                Map.of("authors", java.util.Collections.nCopies(100, a),
                        "quotes", java.util.Collections.nCopies(100, q)));
        assertEquals(100, maximum.path("authors").size());
        assertEquals(100, maximum.path("quotes").size());
        assertEquals(1, candidateAuthors.count());
        assertEquals(1, candidateQuotes.count());
    }

    private Map<String, Object> batchQuote(String key, String authorKey) {
        var request = quote(key, 1);
        request.remove("candidateAuthorId");
        request.put("candidateAuthorImportKey", authorKey);
        return request;
    }

    @Test
    void importsAnonymousDtosAndPreservesProvenanceAndReviewOnRetry() throws Exception {
        var authorRequest = author("enwikiquote:2");
        authorRequest.put("id", 999);
        authorRequest.put("status", "APPROVED");
        authorRequest.put("publishedAuthorId", 999);
        var a = postJson("/api/candidate-authors", authorRequest);
        long authorId = a.path("id").asLong();
        assertNotEquals(999, authorId);
        assertEquals("PENDING", a.path("status").asText());
        assertFalse(a.has("publishedAuthorId"));
        assertFalse(a.has("quotes"));
        assertEquals("2026-10-01", a.path("dumpDate").asText());
        assertEquals(2, a.path("sourcePageId").asLong());
        assertEquals(4021123, a.path("sourceRevisionId").asLong());
        assertEquals("https://en.wikiquote.org/wiki/Albert_Einstein", a.path("sourceUrl").asText());

        var quoteRequest = quote("enwikiquote:2:quote:abc", authorId);
        var q = postJson("/api/candidate-quotes", quoteRequest);
        long quoteId = q.path("id").asLong();
        assertEquals(authorId, q.path("candidateAuthorId").asLong());
        assertEquals("* ''Original quotation.''", q.path("rawWikitext").asText());
        assertEquals("** Book, page 42.", q.path("sourceNotes").asText());
        assertFalse(q.has("candidateAuthor"));
        assertFalse(q.has("publishedQuote"));
        mvc.perform(put("/api/candidate-authors/{id}", authorId).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Edited name\",\"status\":\"REJECTED\",\"sourceTitle\":\"Changed\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sourceTitle").value("Albert Einstein"));
        mvc.perform(put("/api/candidate-quotes/{id}", quoteId).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"Edited quote.\",\"status\":\"REJECTED\",\"rawWikitext\":\"Changed\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rawWikitext").value("* ''Original quotation.''"));
        authorRequest.put("sourceRevisionId", 5000000);
        authorRequest.put("dumpDate", "2026-11-01");
        var retryAuthor = postJson("/api/candidate-authors", authorRequest);
        assertEquals(authorId, retryAuthor.path("id").asLong());
        assertEquals("Edited name", retryAuthor.path("fullName").asText());
        assertEquals("REJECTED", retryAuthor.path("status").asText());
        assertEquals(4021123, retryAuthor.path("sourceRevisionId").asLong());
        assertEquals("2026-10-01", retryAuthor.path("dumpDate").asText());
        var retryQuote = postJson("/api/candidate-quotes", quoteRequest);
        assertEquals(quoteId, retryQuote.path("id").asLong());
        assertEquals("Edited quote.", retryQuote.path("text").asText());
        assertEquals("REJECTED", retryQuote.path("status").asText());
        assertEquals(1, candidateAuthors.count());
        assertEquals(1, candidateQuotes.count());
        mvc.perform(get("/api/authors")).andExpect(jsonPath("$.page.totalElements").value(0));
        mvc.perform(get("/api/quotes")).andExpect(jsonPath("$.page.totalElements").value(0));
        mvc.perform(head("/api/candidate-authors/{id}", authorId)).andExpect(status().isOk());
        mvc.perform(head("/api/candidate-quotes/{id}", quoteId)).andExpect(status().isOk());
    }

    @Test
    void rejectsReuseOfImportKeyForDifferentSourceOrParent() throws Exception {
        var a = author("enwikiquote:2");
        long id = postJson("/api/candidate-authors", a).path("id").asLong();
        a.put("sourcePageId", 4);
        assertPostStatus("/api/candidate-authors", a, 409);
        a.put("sourcePageId", 2);
        a.put("source", "other-wiki");
        assertPostStatus("/api/candidate-authors", a, 409);
        long other = postJson("/api/candidate-authors", author("enwikiquote:other")).path("id").asLong();
        var q = quote("enwikiquote:quote:one", id);
        postJson("/api/candidate-quotes", q);
        q.put("candidateAuthorId", other);
        assertPostStatus("/api/candidate-quotes", q, 409);
        assertEquals(1, candidateQuotes.count());
    }

    @Test
    void listsWithStatusParentPaginationAndNoEntityGraphs() throws Exception {
        long a = postJson("/api/candidate-authors", author("enwikiquote:one")).path("id").asLong();
        long b = postJson("/api/candidate-authors", author("enwikiquote:two")).path("id").asLong();
        long first = postJson("/api/candidate-quotes", quote("enwikiquote:q:one", a)).path("id").asLong();
        long second = postJson("/api/candidate-quotes", quote("enwikiquote:q:two", a)).path("id").asLong();
        postJson("/api/candidate-quotes", quote("enwikiquote:q:three", b));
        mvc.perform(put("/api/candidate-quotes/{id}", first).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"Rejected quote.\",\"status\":\"REJECTED\"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/candidate-quotes").param("candidateAuthorId", Long.toString(a))
                        .param("size", "1").param("page", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(second))
                .andExpect(jsonPath("$.page.totalElements").value(2))
                .andExpect(jsonPath("$.page.totalPages").value(2));
        mvc.perform(get("/api/candidate-quotes").param("candidateAuthorId", Long.toString(a))
                        .param("status", "PENDING"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(second))
                .andExpect(jsonPath("$.page.totalElements").value(1));
        mvc.perform(get("/api/candidate-quotes").param("candidateAuthorId", Long.toString(b))
                        .param("status", "REJECTED"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content").isEmpty());
        mvc.perform(get("/api/candidate-authors").param("size", "1").param("page", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(b))
                .andExpect(jsonPath("$.page.totalElements").value(2));
        mvc.perform(get("/api/candidate-authors").param("status", "APPROVED"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content").isEmpty());
        mvc.perform(get("/api/candidate-authors").param("status", "SNOOZED"))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/candidate-authors/{id}", a).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Author\",\"status\":\"SNOOZED\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/candidate-quotes/{id}", first).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"Snoozed quote.\",\"status\":\"SNOOZED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SNOOZED"));
        mvc.perform(get("/api/candidate-quotes").param("status", "SNOOZED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(first))
                .andExpect(jsonPath("$.page.totalElements").value(1));
        mvc.perform(get("/api/candidate-quotes/{id}", second))
                .andExpect(status().isOk()).andExpect(jsonPath("$.candidateAuthorId").value(a));
    }

    @Test
    void snoozesEveryQuoteForAnAuthorWithoutChangingTheAuthorOrOtherQuotes() throws Exception {
        long authorId = postJson("/api/candidate-authors", author("enwikiquote:snooze-author"))
                .path("id").asLong();
        long otherAuthorId = postJson("/api/candidate-authors", author("enwikiquote:other-author"))
                .path("id").asLong();
        long firstQuoteId = postJson("/api/candidate-quotes", quote("enwikiquote:snooze-one", authorId))
                .path("id").asLong();
        postJson("/api/candidate-quotes", quote("enwikiquote:snooze-two", authorId));
        long otherQuoteId = postJson("/api/candidate-quotes", quote("enwikiquote:other-quote", otherAuthorId))
                .path("id").asLong();
        mvc.perform(put("/api/candidate-quotes/{id}", firstQuoteId).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"Edited quote.\",\"status\":\"REJECTED\"}"))
                .andExpect(status().isOk());

        mvc.perform(post("/api/candidate-authors/{id}/snooze-quotes", authorId))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/candidate-authors/{id}/snooze-quotes", authorId).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"));
        mvc.perform(get("/api/candidate-authors/{id}", authorId))
                .andExpect(jsonPath("$.status").value("PENDING"));
        mvc.perform(get("/api/candidate-quotes").param("candidateAuthorId", Long.toString(authorId))
                        .param("status", "SNOOZED"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.page.totalElements").value(2));
        mvc.perform(get("/api/candidate-quotes/{id}", firstQuoteId))
                .andExpect(jsonPath("$.text").value("Edited quote."))
                .andExpect(jsonPath("$.status").value("SNOOZED"));
        mvc.perform(get("/api/candidate-quotes/{id}", otherQuoteId))
                .andExpect(jsonPath("$.status").value("PENDING"));
    }

    @Test
    void promotesNewAndExistingAuthorsIdempotentlyAndRequiresAuthenticationAndCsrf() throws Exception {
        long newCandidateId = postJson("/api/candidate-authors", author("enwikiquote:promote-new"))
                .path("id").asLong();
        var newAuthorRequest = Map.of("fullName", "Promoted Author", "dateOfBirth", "1900-01-01");
        mvc.perform(post("/api/candidate-authors/{id}/promote", newCandidateId).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(newAuthorRequest)))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/candidate-authors/{id}/promote", newCandidateId).with(oidcLogin())
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(newAuthorRequest)))
                .andExpect(status().isForbidden());

        var firstPromotion = json.readTree(mvc.perform(post("/api/candidate-authors/{id}/promote", newCandidateId)
                        .with(oidcLogin()).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(newAuthorRequest)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.candidate.status").value("APPROVED"))
                .andReturn().getResponse().getContentAsString());
        var retryRequest = Map.of("fullName", "Different retry payload", "dateOfBirth", "1950-01-01");
        var retriedPromotion = json.readTree(mvc.perform(post("/api/candidate-authors/{id}/promote", newCandidateId)
                        .with(oidcLogin()).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(retryRequest)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertEquals(firstPromotion.path("candidate").path("publishedAuthorId"),
                retriedPromotion.path("candidate").path("publishedAuthorId"));
        assertEquals("Promoted Author", retriedPromotion.path("author").path("fullName").asText());
        assertEquals(1, authors.count());

        var existing = new Author("Existing Author");
        existing.setDateOfBirth(LocalDate.of(1920, 1, 1));
        existing = authors.saveAndFlush(existing);
        long linkCandidateId = postJson("/api/candidate-authors", author("enwikiquote:promote-link"))
                .path("id").asLong();
        long existingId = existing.getId();
        var linkRequest = Map.of("publishedAuthorId", existingId);
        mvc.perform(post("/api/candidate-authors/{id}/link", linkCandidateId).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(linkRequest)))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/candidate-authors/{id}/link", linkCandidateId).with(oidcLogin())
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(linkRequest)))
                .andExpect(status().isForbidden());
        var linked = mvc.perform(post("/api/candidate-authors/{id}/link", linkCandidateId)
                        .with(oidcLogin()).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(linkRequest)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.candidate.status").value("APPROVED"))
                .andReturn().getResponse().getContentAsString();
        mvc.perform(post("/api/candidate-authors/{id}/link", linkCandidateId)
                        .with(oidcLogin()).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("publishedAuthorId", firstPromotion
                                .path("author").path("id").asLong()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.author.id").value(existingId));
        assertEquals(existingId, json.readTree(linked).path("author").path("id").asLong());
        assertEquals(2, authors.count());

        long previouslyLinkedId = postJson("/api/candidate-authors", author("enwikiquote:previously-linked"))
                .path("id").asLong();
        mvc.perform(put("/api/candidate-authors/{id}", previouslyLinkedId).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of(
                                "fullName", "Existing Author", "status", "PENDING", "publishedAuthorId", existingId))))
                .andExpect(status().isOk());
        mvc.perform(post("/api/candidate-authors/{id}/link", previouslyLinkedId)
                        .with(oidcLogin()).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(linkRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.candidate.status").value("APPROVED"))
                .andExpect(jsonPath("$.author.id").value(existingId));
    }

    @Test
    void atomicallyPromotesQuotesIdempotentlyAndRejectsPromotionAfterRejection() throws Exception {
        long authorId = postJson("/api/candidate-authors", author("enwikiquote:quote-promote-parent"))
                .path("id").asLong();
        Author publishedAuthor = new Author("Quote Author");
        publishedAuthor.setDateOfBirth(LocalDate.of(1900, 1, 1));
        publishedAuthor = authors.saveAndFlush(publishedAuthor);
        long candidateQuoteId = postJson("/api/candidate-quotes",
                quote("enwikiquote:quote-promote", authorId)).path("id").asLong();
        var request = Map.of("text", "Promoted quotation.", "authorId", publishedAuthor.getId());

        mvc.perform(post("/api/candidate-quotes/{id}/promote", candidateQuoteId).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/candidate-quotes/{id}/promote", candidateQuoteId).with(oidcLogin())
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
                .andExpect(status().isForbidden());
        var first = json.readTree(mvc.perform(post("/api/candidate-quotes/{id}/promote", candidateQuoteId)
                        .with(oidcLogin()).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(request)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.candidate.status").value("APPROVED"))
                .andReturn().getResponse().getContentAsString());
        var differentRetry = Map.of("text", "Different retry payload.", "authorId", publishedAuthor.getId());
        var retry = json.readTree(mvc.perform(post("/api/candidate-quotes/{id}/promote", candidateQuoteId)
                        .with(oidcLogin()).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(differentRetry)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertEquals(first.path("quote").path("id"), retry.path("quote").path("id"));
        assertEquals("Promoted quotation.", retry.path("quote").path("text").asText());
        assertEquals("Promoted quotation.", retry.path("candidate").path("text").asText());
        assertEquals(1, quotes.count());

        long previouslyLinkedQuoteId = postJson("/api/candidate-quotes",
                quote("enwikiquote:previously-linked-quote", authorId)).path("id").asLong();
        mvc.perform(put("/api/candidate-quotes/{id}", previouslyLinkedQuoteId).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of(
                                "text", "Promoted quotation.", "status", "PENDING",
                                "publishedQuoteId", first.path("quote").path("id").asLong()))))
                .andExpect(status().isOk());
        mvc.perform(post("/api/candidate-quotes/{id}/promote", previouslyLinkedQuoteId)
                        .with(oidcLogin()).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(differentRetry)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.candidate.status").value("APPROVED"))
                .andExpect(jsonPath("$.quote.id").value(first.path("quote").path("id").asLong()));

        long afterRejectionId = postJson("/api/candidate-quotes",
                quote("enwikiquote:quote-after-author-rejection", authorId)).path("id").asLong();
        mvc.perform(post("/api/candidate-authors/{id}/reject", authorId).with(csrf()))
                .andExpect(status().isOk());
        mvc.perform(put("/api/candidate-quotes/{id}", afterRejectionId).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"Still staged.\",\"status\":\"PENDING\"}"))
                .andExpect(status().isOk());
        mvc.perform(post("/api/candidate-quotes/{id}/promote", afterRejectionId).with(oidcLogin()).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
                .andExpect(status().isConflict());
        assertPostStatus("/api/candidate-quotes", quote("enwikiquote:quote-import-after-rejection", authorId), 409);
        assertEquals(1, quotes.count());
    }

    @Test
    void rollsBackPublishedRecordWhenCandidatePromotionCannotComplete() throws Exception {
        long candidateAuthorId = postJson("/api/candidate-authors", author("enwikiquote:rollback-author"))
                .path("id").asLong();
        jdbc.execute("ALTER TABLE candidate_authors ADD CONSTRAINT block_author_promotion CHECK (status <> 'APPROVED')");
        try {
            var request = Map.of("fullName", "Must Roll Back", "dateOfBirth", "1900-01-01");
            assertThrows(jakarta.servlet.ServletException.class, () ->
                    mvc.perform(post("/api/candidate-authors/{id}/promote", candidateAuthorId)
                                    .with(oidcLogin()).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                                    .content(json.writeValueAsString(request))));
            assertEquals(0, authors.count());
            mvc.perform(get("/api/candidate-authors/{id}", candidateAuthorId))
                    .andExpect(jsonPath("$.status").value("PENDING"))
                    .andExpect(jsonPath("$.publishedAuthorId").doesNotExist());
        } finally {
            jdbc.execute("ALTER TABLE candidate_authors DROP CONSTRAINT block_author_promotion");
        }

        long publishedAuthorId;
        var publishedAuthor = new Author("Quote Rollback Author");
        publishedAuthor.setDateOfBirth(LocalDate.of(1900, 1, 1));
        publishedAuthorId = authors.saveAndFlush(publishedAuthor).getId();
        long candidateQuoteId = postJson("/api/candidate-quotes",
                quote("enwikiquote:rollback-quote", candidateAuthorId)).path("id").asLong();
        jdbc.execute("ALTER TABLE candidate_quotes ADD CONSTRAINT block_quote_promotion CHECK (status <> 'APPROVED')");
        try {
            var request = Map.of("text", "Must roll back.", "authorId", publishedAuthorId);
            assertThrows(jakarta.servlet.ServletException.class, () ->
                    mvc.perform(post("/api/candidate-quotes/{id}/promote", candidateQuoteId)
                                    .with(oidcLogin()).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                                    .content(json.writeValueAsString(request))));
            assertEquals(0, quotes.count());
            mvc.perform(get("/api/candidate-quotes/{id}", candidateQuoteId))
                    .andExpect(jsonPath("$.status").value("PENDING"))
                    .andExpect(jsonPath("$.publishedQuoteId").doesNotExist());
        } finally {
            jdbc.execute("ALTER TABLE candidate_quotes DROP CONSTRAINT block_quote_promotion");
        }
    }

    @Test
    void concurrentAuthorPromotionsReturnTheSamePublishedAuthor() throws Exception {
        long candidateId = postJson("/api/candidate-authors", author("enwikiquote:concurrent-author"))
                .path("id").asLong();
        var request = json.writeValueAsString(Map.of("fullName", "Concurrent Author", "dateOfBirth", "1900-01-01"));
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> promoteAuthorConcurrently(candidateId, request, start));
            var second = executor.submit(() -> promoteAuthorConcurrently(candidateId, request, start));
            start.countDown();
            var firstResponse = first.get(10, TimeUnit.SECONDS);
            var secondResponse = second.get(10, TimeUnit.SECONDS);
            assertEquals(firstResponse.path("author").path("id"), secondResponse.path("author").path("id"));
            assertEquals(1, authors.count());
            assertEquals(1, candidateAuthors.count());
        }
    }

    @Test
    void concurrentQuotePromotionsReturnTheSamePublishedQuote() throws Exception {
        long candidateAuthorId = postJson("/api/candidate-authors", author("enwikiquote:concurrent-quote-author"))
                .path("id").asLong();
        Author publishedAuthor = new Author("Concurrent Quote Author");
        publishedAuthor.setDateOfBirth(LocalDate.of(1900, 1, 1));
        long publishedAuthorId = authors.saveAndFlush(publishedAuthor).getId();
        long candidateQuoteId = postJson("/api/candidate-quotes",
                quote("enwikiquote:concurrent-quote", candidateAuthorId)).path("id").asLong();
        var request = json.writeValueAsString(Map.of("text", "Concurrent quote.", "authorId", publishedAuthorId));
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> promoteQuoteConcurrently(candidateQuoteId, request, start));
            var second = executor.submit(() -> promoteQuoteConcurrently(candidateQuoteId, request, start));
            start.countDown();
            var firstResponse = first.get(10, TimeUnit.SECONDS);
            var secondResponse = second.get(10, TimeUnit.SECONDS);
            assertEquals(firstResponse.path("quote").path("id"), secondResponse.path("quote").path("id"));
            assertEquals(1, quotes.count());
        }
    }

    private JsonNode promoteAuthorConcurrently(long candidateId, String request, CountDownLatch start)
            throws Exception {
        assertTrue(start.await(5, TimeUnit.SECONDS));
        var response = mvc.perform(post("/api/candidate-authors/{id}/promote", candidateId)
                        .with(oidcLogin()).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(response);
    }

    private JsonNode promoteQuoteConcurrently(long candidateId, String request, CountDownLatch start)
            throws Exception {
        assertTrue(start.await(5, TimeUnit.SECONDS));
        var response = mvc.perform(post("/api/candidate-quotes/{id}/promote", candidateId)
                        .with(oidcLogin()).with(csrf()).contentType(MediaType.APPLICATION_JSON).content(request))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(response);
    }

    @Test
    void rejectsCandidateAuthorAndAllItsQuotesWithoutDeletingQuoteData() throws Exception {
        var publishedAuthor = new Author("Published Author");
        publishedAuthor.setDateOfBirth(LocalDate.of(1900, 1, 1));
        publishedAuthor = authors.saveAndFlush(publishedAuthor);
        long publishedQuoteId = quotes.saveAndFlush(new Quote("Published quote.", publishedAuthor)).getId();
        long authorId = postJson("/api/candidate-authors", author("enwikiquote:reject-author"))
                .path("id").asLong();
        long linkedQuoteId = postJson("/api/candidate-quotes", quote("enwikiquote:reject-one", authorId))
                .path("id").asLong();
        long otherQuoteId = postJson("/api/candidate-quotes", quote("enwikiquote:reject-other", authorId))
                .path("id").asLong();
        mvc.perform(put("/api/candidate-quotes/{id}", linkedQuoteId).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of(
                                "text", "Reviewed quote.", "status", "APPROVED",
                                "publishedQuoteId", publishedQuoteId))))
                .andExpect(status().isOk());

        mvc.perform(post("/api/candidate-authors/{id}/reject", authorId).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"));
        mvc.perform(get("/api/candidate-quotes").param("candidateAuthorId", Long.toString(authorId))
                        .param("status", "REJECTED"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.page.totalElements").value(2));
        mvc.perform(get("/api/candidate-quotes/{id}", linkedQuoteId))
                .andExpect(jsonPath("$.text").value("Reviewed quote."))
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.publishedQuoteId").value(publishedQuoteId));
        mvc.perform(get("/api/candidate-quotes/{id}", otherQuoteId))
                .andExpect(jsonPath("$.status").value("REJECTED"));
        assertTrue(quotes.existsById(publishedQuoteId));
    }

    @Test
    void linksPublishedRecordsWithoutCreatingThemAndClearsOmittedLinks() throws Exception {
        Author publishedAuthor = new Author("Published Author");
        publishedAuthor.setDateOfBirth(LocalDate.of(1900, 1, 1));
        publishedAuthor = authors.saveAndFlush(publishedAuthor);
        long publishedId = publishedAuthor.getId();
        long publishedQuoteId = quotes.saveAndFlush(new Quote("Published quote.", publishedAuthor)).getId();
        long a = postJson("/api/candidate-authors", author("enwikiquote:one")).path("id").asLong();
        long q = postJson("/api/candidate-quotes", quote("enwikiquote:quote", a)).path("id").asLong();
        mvc.perform(put("/api/candidate-authors/{id}", a).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of(
                                "fullName", "Reviewed", "status", "APPROVED", "publishedAuthorId", publishedId))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.publishedAuthorId").value(publishedId));
        mvc.perform(put("/api/candidate-quotes/{id}", q).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of(
                                "text", "Reviewed.", "status", "APPROVED", "publishedQuoteId", publishedQuoteId))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.publishedQuoteId").value(publishedQuoteId));
        mvc.perform(delete("/api/quotes/{id}", publishedQuoteId).with(oidcLogin()).with(csrf()))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("urn:quote-db:problem:quote-linked-to-candidates"))
                .andExpect(jsonPath("$.code").value("QUOTE_LINKED_TO_CANDIDATES"))
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.detail").value("Quote is linked to candidate review data"));
        mvc.perform(put("/api/candidate-quotes/{id}", q).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of(
                                "text", "Invalid edit.", "status", "PENDING", "publishedQuoteId", 999999))))
                .andExpect(status().isBadRequest())
                .andExpect(content().string(containsString("publishedQuoteId")));
        mvc.perform(get("/api/candidate-quotes/{id}", q))
                .andExpect(jsonPath("$.text").value("Reviewed."))
                .andExpect(jsonPath("$.status").value("APPROVED"));
        mvc.perform(put("/api/candidate-quotes/{id}", q).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"Reviewed.\",\"status\":\"APPROVED\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.publishedQuoteId").doesNotExist());
        mvc.perform(delete("/api/quotes/{id}", publishedQuoteId).with(oidcLogin()).with(csrf()))
                .andExpect(status().isOk());
        mvc.perform(delete("/api/authors/{id}", publishedId).with(oidcLogin()).with(csrf()))
                .andExpect(status().isConflict());
        mvc.perform(put("/api/candidate-authors/{id}", a).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Reviewed\",\"status\":\"APPROVED\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.publishedAuthorId").doesNotExist());
        assertEquals(1, authors.count());
        assertEquals(0, quotes.count());
    }

    @ParameterizedTest
    @ValueSource(strings = {"PENDING", "REJECTED"})
    void deletesQuoteAndUpdatesAllLinkedCandidatesAtomically(String candidateStatus) throws Exception {
        var publishedAuthor = new Author("Published Author");
        publishedAuthor.setDateOfBirth(LocalDate.of(1900, 1, 1));
        publishedAuthor = authors.saveAndFlush(publishedAuthor);
        long publishedQuoteId = quotes.saveAndFlush(new Quote("Published quote.", publishedAuthor)).getId();
        long otherQuoteId = quotes.saveAndFlush(new Quote("Unrelated quote.", publishedAuthor)).getId();
        long a = postJson("/api/candidate-authors", author("enwikiquote:one")).path("id").asLong();
        var linked = new java.util.ArrayList<JsonNode>();
        for (String key : new String[]{"first", "second", "unrelated"}) {
            long q = postJson("/api/candidate-quotes", quote("enwikiquote:" + key, a)).path("id").asLong();
            linked.add(json.readTree(mvc.perform(put("/api/candidate-quotes/{id}", q).with(csrf())
                            .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of(
                                    "text", "Reviewed " + key, "status", "APPROVED",
                                    "publishedQuoteId", key.equals("unrelated") ? otherQuoteId : publishedQuoteId))))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()));
        }
        for (String invalid : new String[]{"APPROVED", "SNOOZED", "UNKNOWN"}) {
            mvc.perform(delete("/api/quotes/{id}", publishedQuoteId).param("candidateStatus", invalid)
                            .with(oidcLogin()).with(csrf()))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(delete("/api/quotes/{id}", publishedQuoteId).param("candidateStatus", candidateStatus).with(csrf()))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/quotes/{id}", publishedQuoteId).param("candidateStatus", candidateStatus).with(oidcLogin()))
                .andExpect(status().isForbidden());

        jdbc.execute("CREATE TABLE quote_delete_blocker (quote_id BIGINT REFERENCES quotes(id))");
        try {
            jdbc.update("INSERT INTO quote_delete_blocker (quote_id) VALUES (?)", publishedQuoteId);
            assertThrows(jakarta.servlet.ServletException.class, () ->
                    mvc.perform(delete("/api/quotes/{id}", publishedQuoteId).param("candidateStatus", candidateStatus)
                            .with(oidcLogin()).with(csrf())));
            assertTrue(quotes.existsById(publishedQuoteId));
            for (JsonNode before : linked) {
                var after = json.readTree(mvc.perform(get("/api/candidate-quotes/{id}", before.path("id").asLong()))
                        .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
                assertEquals(before, after);
            }
        } finally {
            jdbc.execute("DROP TABLE quote_delete_blocker");
        }
        mvc.perform(delete("/api/quotes/{id}", publishedQuoteId).param("candidateStatus", candidateStatus)
                        .with(oidcLogin()).with(csrf()))
                .andExpect(status().isOk());
        assertFalse(quotes.existsById(publishedQuoteId));
        assertTrue(quotes.existsById(otherQuoteId));
        assertTrue(authors.existsById(publishedAuthor.getId()));
        for (int i = 0; i < linked.size(); i++) {
            var before = (com.fasterxml.jackson.databind.node.ObjectNode) linked.get(i).deepCopy();
            if (i < 2) {
                before.put("status", candidateStatus);
                before.remove("publishedQuoteId");
            }
            var after = json.readTree(mvc.perform(get("/api/candidate-quotes/{id}", before.path("id").asLong()))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
            assertEquals(before, after);
        }
        // Retrying a completed deletion is harmless and does not change candidate status again.
        mvc.perform(delete("/api/quotes/{id}", publishedQuoteId).param("candidateStatus", "PENDING")
                        .with(oidcLogin()).with(csrf()))
                .andExpect(status().isOk());
        mvc.perform(get("/api/candidate-quotes/{id}", linked.getFirst().path("id").asLong()))
                .andExpect(jsonPath("$.status").value(candidateStatus));
    }

    @Test
    void validatesRequestsIdsAndPaginationAndKeepsExistingApiSecurity() throws Exception {
        for (String endpoint : new String[]{"/api/candidate-authors", "/api/candidate-quotes"}) {
            mvc.perform(post(endpoint).with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{}"))
                    .andExpect(status().isBadRequest());
            mvc.perform(get(endpoint).param("page", "-1")).andExpect(status().isBadRequest());
            mvc.perform(get(endpoint).param("size", "0")).andExpect(status().isBadRequest());
            mvc.perform(get(endpoint).param("size", "101")).andExpect(status().isBadRequest());
            mvc.perform(get(endpoint).param("status", "UNKNOWN")).andExpect(status().isBadRequest());
            mvc.perform(get(endpoint + "/99999")).andExpect(status().isNotFound());
            mvc.perform(put(endpoint + "/99999").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                            .content("{\"text\":\"Quote\",\"fullName\":\"Author\",\"status\":\"PENDING\"}"))
                    .andExpect(status().isNotFound());
        }
        var bad = author("enwikiquote:one");
        bad.put("importKey", "INVALID KEY");
        assertPostStatus("/api/candidate-authors", bad, 400);
        bad = author("enwikiquote:one");
        bad.put("sourcePageId", 0);
        assertPostStatus("/api/candidate-authors", bad, 400);
        bad = author("enwikiquote:one");
        bad.put("sourceUrl", "javascript:alert(1)");
        assertPostStatus("/api/candidate-authors", bad, 400);
        bad = author("enwikiquote:one");
        bad.put("fullName", "x".repeat(256));
        assertPostStatus("/api/candidate-authors", bad, 400);
        assertPostStatus("/api/candidate-quotes", quote("enwikiquote:quote", 999999L), 400);
        long a = postJson("/api/candidate-authors", author("enwikiquote:one")).path("id").asLong();
        var oversized = quote("enwikiquote:oversized", a);
        oversized.put("rawWikitext", "x".repeat(16001));
        assertPostStatus("/api/candidate-quotes", oversized, 400);
        mvc.perform(get("/api/candidate-quotes").param("candidateAuthorId", "0"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/candidate-authors").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(author("enwikiquote:no-csrf"))))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/authors").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Protected\",\"dateOfBirth\":\"1900-01-01\"}"))
                .andExpect(status().isUnauthorized());
        assertEquals(1, candidateAuthors.count());
        assertEquals(0, candidateQuotes.count());
    }

    private Map<String, Object> provenance(String key) {
        return new LinkedHashMap<>(Map.of(
                "importKey", key, "source", "enwikiquote", "sourcePageId", 2,
                "sourceRevisionId", 4021123, "dumpDate", "2026-10-01",
                "sourceTitle", "Albert Einstein",
                "sourceUrl", "https://en.wikiquote.org/wiki/Albert_Einstein"));
    }

    private Map<String, Object> author(String key) {
        var request = provenance(key);
        request.put("fullName", "Albert Einstein");
        return request;
    }

    private Map<String, Object> quote(String key, long authorId) {
        var request = provenance(key);
        request.put("candidateAuthorId", authorId);
        request.put("text", "Original quotation.");
        request.put("rawWikitext", "* ''Original quotation.''");
        request.put("sourceNotes", "** Book, page 42.");
        return request;
    }

    private JsonNode postJson(String endpoint, Object request) throws Exception {
        return json.readTree(mvc.perform(post(endpoint).with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(request)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private void assertPostStatus(String endpoint, Object request, int code) throws Exception {
        mvc.perform(post(endpoint).with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(request)))
                .andExpect(status().is(code));
    }
}
