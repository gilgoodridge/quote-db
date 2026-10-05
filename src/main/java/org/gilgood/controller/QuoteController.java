package org.gilgood.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import org.gilgood.dto.CreateQuoteRequest;
import org.gilgood.dto.QuoteResponse;
import org.gilgood.dto.UpdateQuoteRequest;
import org.gilgood.entity.Quote;
import org.gilgood.mapper.QuoteMapper;
import org.gilgood.repository.QuoteRepository;
import org.springframework.beans.factory.annotation.Autowired;
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
    @Operation(summary = "List all quotes")
    public List<QuoteResponse> listQuotes() {
        return quoteRepository.findAll()
                .stream()
                .map(quoteMapper::toResponse)
                .collect(Collectors.toList());
    }

    @GetMapping("/{id}")
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
    @Operation(summary = "Create new quote")
    public QuoteResponse addQuote(@RequestBody CreateQuoteRequest request) {
        Quote quote = quoteMapper.toEntity(request);
        Quote saved = quoteRepository.save(quote);
        return quoteMapper.toResponse(saved);
    }

    @PutMapping("/{id}")
    @Operation(
            summary = "Replace quote (full update)",
            description = "Replaces the entire quote record. " +
                    "Any optional fields omitted or set to null will be deleted from the database. " +
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
