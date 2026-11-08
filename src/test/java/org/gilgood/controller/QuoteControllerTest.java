package org.gilgood.controller;

import org.gilgood.entity.Author;
import org.gilgood.entity.Quote;
import org.gilgood.entity.Tone;
import org.gilgood.exception.GlobalExceptionHandler;
import org.gilgood.mapper.AuthorMapper;
import org.gilgood.mapper.CategoryMapper;
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
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Set;

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
        ReflectionTestUtils.setField(mapper, "categoryMapper", Mappers.getMapper(CategoryMapper.class));
        ReflectionTestUtils.setField(controller, "quoteRepository", repository);
        ReflectionTestUtils.setField(controller, "quoteMapper", mapper);
        mvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler()).build();
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "\t\n", "\u2003"})
    void omittedOrBlankQueryPreservesListing(String query) throws Exception {
        var pageable = PageRequest.of(0, 20, Sort.by("id"));
        when(repository.findAll(pageable)).thenReturn(new PageImpl<>(List.of(quote(1L, "A quote"))));
        when(repository.findByAuthorId(7L, pageable)).thenReturn(new PageImpl<>(List.of(quote(2L, "An author's quote"))));

        mvc.perform(request(query))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(1));
        mvc.perform(request(query).param("authorId", "7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(2));
        verify(repository).findAll(pageable);
        verify(repository).findByAuthorId(7L, pageable);
        verifyNoMoreInteractions(repository);
    }

    @Test
    void searchPreservesRelevanceOrderAndResponseDtos() throws Exception {
        when(repository.search("love life", null, false, List.of(0L), false, List.of(0L),
                false, List.of(0L), false, List.of(0L), PageRequest.of(0, 20)))
                .thenReturn(new PageImpl<>(List.of(quote(9L, "love life"), quote(3L, "life"))));
        mvc.perform(request("  love life  "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(9))
                .andExpect(jsonPath("$.content[0].text").value("love life"))
                .andExpect(jsonPath("$.content[0].searchText").doesNotExist())
                .andExpect(jsonPath("$.content[0].author.fullName").value("Test Author"))
                .andExpect(jsonPath("$.content[0].author.quotes").doesNotExist())
                .andExpect(jsonPath("$.content[1].id").value(3));
        verify(repository).search("love life", null, false, List.of(0L), false, List.of(0L),
                false, List.of(0L), false, List.of(0L), PageRequest.of(0, 20));
        verifyNoMoreInteractions(repository);
    }

    @Test
    void searchIncludesCategoryDtosInIdOrder() throws Exception {
        Tone funny = new Tone();
        funny.setId(2L);
        funny.setName("Funny");
        funny.setDescription("Amuses through wit.");
        Tone insightful = new Tone();
        insightful.setId(3L);
        insightful.setName("Insightful");
        Quote match = quote(9L, "A funny observation");
        match.setTones(Set.of(insightful, funny));
        when(repository.search("funni", null, false, List.of(0L), false, List.of(0L),
                false, List.of(0L), false, List.of(0L), PageRequest.of(0, 20))).thenReturn(new PageImpl<>(List.of(match)));
        mvc.perform(request("funny"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].tones[0].id").value(2))
                .andExpect(jsonPath("$.content[0].tones[0].name").value("Funny"))
                .andExpect(jsonPath("$.content[0].tones[0].description").value("Amuses through wit."))
                .andExpect(jsonPath("$.content[0].tones[1].name").value("Insightful"))
                .andExpect(jsonPath("$.content[0].themes").isEmpty())
                .andExpect(jsonPath("$.content[0].forms").isEmpty())
                .andExpect(jsonPath("$.content[0].sources").isEmpty());
    }

    @Test
    void combinesSearchWithAuthorAndDoesNotParseConnectors() throws Exception {
        when(repository.search("love or life", 7L, false, List.of(0L), false, List.of(0L),
                false, List.of(0L), false, List.of(0L), PageRequest.of(0, 20))).thenReturn(new PageImpl<>(List.of()));
        mvc.perform(request("love OR +life").param("authorId", "7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isEmpty());
        verify(repository).search("love or life", 7L, false, List.of(0L), false, List.of(0L),
                false, List.of(0L), false, List.of(0L), PageRequest.of(0, 20));
        verifyNoMoreInteractions(repository);
    }

    @Test
    void normalizesOtherWordFormsBeforeSearching() throws Exception {
        when(repository.search("hope", null, false, List.of(0L), false, List.of(0L),
                false, List.of(0L), false, List.of(0L), PageRequest.of(0, 20))).thenReturn(new PageImpl<>(List.of(quote(1L, "We hoped for peace."))));
        mvc.perform(request("HOPING"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].text").value("We hoped for peace."))
                .andExpect(jsonPath("$.content[0].searchText").doesNotExist());
        verify(repository).search("hope", null, false, List.of(0L), false, List.of(0L),
                false, List.of(0L), false, List.of(0L), PageRequest.of(0, 20));
        verifyNoMoreInteractions(repository);
    }

    @Test
    void punctuationOnlyQueryDoesNotFallBackToListing() throws Exception {
        when(repository.search("", null, false, List.of(0L), false, List.of(0L),
                false, List.of(0L), false, List.of(0L), PageRequest.of(0, 20))).thenReturn(new PageImpl<>(List.of()));
        mvc.perform(request("... + !!!"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isEmpty());
        verify(repository).search("", null, false, List.of(0L), false, List.of(0L),
                false, List.of(0L), false, List.of(0L), PageRequest.of(0, 20));
        verifyNoMoreInteractions(repository);
    }

    @Test
    void preservesQuotedPhraseWhenCombiningWithAuthorFilter() throws Exception {
        when(repository.search("\"hope for peac\"", 7L, false, List.of(0L), false, List.of(0L),
                false, List.of(0L), false, List.of(0L), PageRequest.of(0, 20))).thenReturn(new PageImpl<>(List.of(quote(1L, "We hoped for peace."))));
        mvc.perform(request("\"HOPING for peace\"").param("authorId", "7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].text").value("We hoped for peace."));
        verify(repository).search("\"hope for peac\"", 7L, false, List.of(0L), false, List.of(0L),
                false, List.of(0L), false, List.of(0L), PageRequest.of(0, 20));
        verifyNoMoreInteractions(repository);
    }

    @Test
    void combinesCategoryFiltersWithTextSearch() throws Exception {
        when(repository.search("love", 7L, true, List.of(2L, 3L), false, List.of(0L),
                true, List.of(5L), false, List.of(0L), PageRequest.of(0, 20))).thenReturn(new PageImpl<>(List.of()));
        mvc.perform(request("love")
                        .param("authorId", "7")
                        .param("toneIds", "2", "3")
                        .param("formIds", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isEmpty());
        verify(repository).search("love", 7L, true, List.of(2L, 3L), false, List.of(0L),
                true, List.of(5L), false, List.of(0L), PageRequest.of(0, 20));
        verifyNoMoreInteractions(repository);
    }

    @Test
    void invalidAuthorIdStillReturnsBadRequest() throws Exception {
        mvc.perform(request("love").param("authorId", "invalid"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(repository);
    }

    @Test
    void passesRequestedPageToFilteredSearchAndReturnsMatchingTotals() throws Exception {
        var pageable = PageRequest.of(2, 1);
        when(repository.search("love", 7L, true, List.of(2L), false, List.of(0L),
                false, List.of(0L), false, List.of(0L), pageable))
                .thenReturn(new PageImpl<>(List.of(quote(3L, "love")), pageable, 5));
        mvc.perform(request("love").param("authorId", "7").param("toneIds", "2")
                        .param("page", "2").param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(3))
                .andExpect(jsonPath("$.page.number").value(2))
                .andExpect(jsonPath("$.page.size").value(1))
                .andExpect(jsonPath("$.page.totalElements").value(5))
                .andExpect(jsonPath("$.page.totalPages").value(5));
        verify(repository).search("love", 7L, true, List.of(2L), false, List.of(0L),
                false, List.of(0L), false, List.of(0L), pageable);
        verifyNoMoreInteractions(repository);
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
