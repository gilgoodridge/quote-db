package org.gilgood.controller;

import org.gilgood.entity.Author;
import org.gilgood.entity.Quote;
import org.gilgood.mapper.AuthorMapper;
import org.gilgood.mapper.QuoteMapper;
import org.gilgood.repository.QuoteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mapstruct.factory.Mappers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class QuoteControllerTest {
    @Mock
    private QuoteRepository repository;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        QuoteController controller = new QuoteController();
        QuoteMapper mapper = Mappers.getMapper(QuoteMapper.class);
        ReflectionTestUtils.setField(mapper, "authorMapper", Mappers.getMapper(AuthorMapper.class));
        ReflectionTestUtils.setField(controller, "quoteRepository", repository);
        ReflectionTestUtils.setField(controller, "quoteMapper", mapper);
        mvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "\t\n", "\u2003"})
    void omittedOrBlankQueryPreservesListing(String query) throws Exception {
        when(repository.findAll()).thenReturn(List.of(quote(1L, "A quote")));
        when(repository.findByAuthorId(7L)).thenReturn(List.of(quote(2L, "An author's quote")));

        mvc.perform(request(query))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1));
        mvc.perform(request(query).param("authorId", "7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(2));
        verify(repository).findAll();
        verify(repository).findByAuthorId(7L);
        verifyNoMoreInteractions(repository);
    }

    @Test
    void searchPreservesRelevanceOrderAndResponseDtos() throws Exception {
        when(repository.search("love life", null))
                .thenReturn(List.of(quote(9L, "love life"), quote(3L, "life")));
        mvc.perform(request("  love life  "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(9))
                .andExpect(jsonPath("$[0].text").value("love life"))
                .andExpect(jsonPath("$[0].author.fullName").value("Test Author"))
                .andExpect(jsonPath("$[0].author.quotes").doesNotExist())
                .andExpect(jsonPath("$[1].id").value(3));
        verify(repository).search("love life", null);
        verifyNoMoreInteractions(repository);
    }

    @Test
    void combinesSearchWithAuthorAndDoesNotParseConnectors() throws Exception {
        when(repository.search("love OR +life", 7L)).thenReturn(List.of());
        mvc.perform(request("love OR +life").param("authorId", "7"))
                .andExpect(status().isOk())
                .andExpect(content().json("[]"));
        verify(repository).search("love OR +life", 7L);
        verifyNoMoreInteractions(repository);
    }

    @Test
    void invalidAuthorIdStillReturnsBadRequest() throws Exception {
        mvc.perform(request("love").param("authorId", "invalid"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(repository);
    }

    private MockHttpServletRequestBuilder request(String query) {
        var request = get("/api/quotes");
        return query == null ? request : request.param("query", query);
    }

    private Quote quote(Long id, String text) {
        Quote quote = new Quote(text, new Author("Test Author"));
        quote.setId(id);
        return quote;
    }
}
