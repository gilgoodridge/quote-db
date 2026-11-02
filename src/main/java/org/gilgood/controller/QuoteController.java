package org.gilgood.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import org.gilgood.dto.CreateQuoteRequest;
import org.gilgood.dto.QuoteResponse;
import org.gilgood.dto.UpdateQuoteRequest;
import org.gilgood.entity.Quote;
import org.gilgood.mapper.QuoteMapper;
import org.gilgood.repository.QuoteRepository;
import org.gilgood.search.QuoteSearchText;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/quotes")
public class QuoteController {

    @Autowired
    private QuoteRepository quoteRepository;

    @Autowired
    private QuoteMapper quoteMapper;

    @GetMapping
    @Transactional(readOnly = true)
    @Operation(summary = "List quotes with optional filters",
            description = "Optionally filters by author ID and searches quote text using MySQL natural-language " +
                    "FULLTEXT search with Snowball English (Porter2) stemming of quotes and queries. Search results are " +
                    "ordered by relevance, then ID. Double quotes preserve phrase matching over stemmed words. " +
                    "No connector syntax is " +
                    "parsed. Omitted or blank query preserves normal listing behavior. MySQL stopwords and " +
                    "minimum indexed word length apply; this is not substring or semantic search.")
    public List<QuoteResponse> listQuotes(
            @RequestParam(required = false) Long authorId,
            @Parameter(description = "Plain-text search terms; any searchable word can match")
            @RequestParam(required = false) String query) {
        List<Quote> quotes;
        if (query != null && !query.isBlank()) {
            quotes = quoteRepository.search(QuoteSearchText.normalizeQuery(query), authorId);
        } else {
            quotes = authorId != null
                    ? quoteRepository.findByAuthorId(authorId)
                    : quoteRepository.findAll();
        }
        return quotes.stream()
                .map(quoteMapper::toResponse)
                .collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    @Operation(summary = "Get a quote by ID")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Quote found"),
            @ApiResponse(responseCode = "404", description = "Quote not found")
    })
    public QuoteResponse getQuote(@PathVariable Long id) {
        Quote quote = quoteRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Quote not found with ID: " + id));
        return quoteMapper.toResponse(quote);
    }

    @PostMapping
    @Transactional
    @Operation(summary = "Create new quote",
            description = "Optional toneIds, themeIds, formIds and sourceIds allow multiple selections from " +
                    "GET /api/categories. Omitted, null or empty arrays leave a dimension unassigned. " +
                    "Unknown or invalid category IDs return 400.")
    public QuoteResponse addQuote(@RequestBody CreateQuoteRequest request) {
        Quote quote = quoteMapper.toEntity(request);
        Quote saved = quoteRepository.save(quote);
        return quoteMapper.toResponse(saved);
    }

    @PutMapping("/{id}")
    @Transactional
    @Operation(
            summary = "Replace quote (full update)",
            description = "Replaces the entire quote record. " +
                    "Any optional fields omitted or set to null will be deleted from the database. " +
                    "This includes toneIds, themeIds, formIds and sourceIds; empty arrays also clear selections. " +
                    "Unknown or invalid category IDs return 400 without changing the quote. " +
                    "Required fields (text, authorId) must be provided; missing required fields will return 400 Bad Request."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Quote updated successfully"),
            @ApiResponse(responseCode = "400", description = "Missing required fields"),
            @ApiResponse(responseCode = "404", description = "Quote not found")
    })
    public QuoteResponse updateQuote(@PathVariable Long id, @RequestBody UpdateQuoteRequest request) {
        Quote quote = quoteRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Quote not found with ID: " + id));
        quoteMapper.updateEntity(request, quote);
        Quote updated = quoteRepository.save(quote);
        return quoteMapper.toResponse(updated);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete quote")
    public void deleteQuote(@PathVariable Long id) {
        quoteRepository.deleteById(id);
    }
}
