package org.gilgood.controller;

import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.gilgood.dto.*;
import org.gilgood.entity.CandidateStatus;
import org.gilgood.service.CandidateService;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PagedModel;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/candidate-quotes")
@RequiredArgsConstructor
public class CandidateQuoteController {
    private final CandidateService candidates;

    @GetMapping
    @Operation(summary = "List candidate quotes", description =
            "Optional PENDING/APPROVED/REJECTED/SNOOZED status and candidateAuthorId combine with AND. " +
                    "ID ascending; zero-based page, size 1-100.")
    public PagedModel<CandidateQuoteResponse> list(
            @RequestParam(required = false) CandidateStatus status,
            @RequestParam(required = false) Long candidateAuthorId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return candidates.listQuotes(status, candidateAuthorId,
                Pagination.request(page, size).withSort(Sort.by("id")));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a candidate quote")
    public CandidateQuoteResponse get(@PathVariable Long id) {
        return candidates.getQuote(id);
    }

    @PostMapping
    @Operation(summary = "Import a candidate quote", description =
            "Requires an existing candidateAuthorId. Repeated importKey returns the existing record unchanged; " +
                    "conflicting source identity or parent returns 409. New candidates are PENDING.")
    public CandidateQuoteResponse importQuote(@Valid @RequestBody ImportCandidateQuoteRequest request) {
        return candidates.importQuote(request);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Replace candidate quote review fields", description =
            "Requires text and status. Omitted/null publishedQuoteId clears the link. " +
                    "Parent, import identity, raw text and provenance stay unchanged. Does not publish a quote.")
    public CandidateQuoteResponse update(@PathVariable Long id,
                                          @Valid @RequestBody UpdateCandidateQuoteRequest request) {
        return candidates.updateQuote(id, request);
    }

    @PostMapping("/{id}/promote")
    @Operation(summary = "Publish and approve a candidate quote atomically",
            description = "Creates the quote and approves the candidate in one transaction. Repeated calls return the existing promotion.")
    public CandidateQuotePromotionResponse promote(@PathVariable Long id,
                                                   @Valid @RequestBody CreateQuoteRequest request) {
        return candidates.promoteQuote(id, request);
    }
}
