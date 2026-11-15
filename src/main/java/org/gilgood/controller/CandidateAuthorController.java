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
@RequestMapping("/api/candidate-authors")
@RequiredArgsConstructor
public class CandidateAuthorController {
    private final CandidateService candidates;

    @GetMapping
    @Operation(summary = "List candidate authors", description =
            "Optional PENDING/APPROVED/REJECTED status. ID ascending; zero-based page, size 1-100.")
    public PagedModel<CandidateAuthorResponse> list(
            @RequestParam(required = false) CandidateStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return candidates.listAuthors(status, Pagination.request(page, size).withSort(Sort.by("id")));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a candidate author")
    public CandidateAuthorResponse get(@PathVariable Long id) {
        return candidates.getAuthor(id);
    }

    @PostMapping
    @Operation(summary = "Import a candidate author", description =
            "New importKey creates a PENDING candidate. Repeated key returns the existing candidate " +
                    "without overwriting review changes or provenance; conflicting source identity returns 409.")
    public CandidateAuthorResponse importAuthor(@Valid @RequestBody ImportCandidateAuthorRequest request) {
        return candidates.importAuthor(request);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Replace candidate author review fields", description =
            "Requires fullName and status. Omitted/null publishedAuthorId clears the link. " +
                    "Import identity and provenance stay unchanged. Does not publish an author.")
    public CandidateAuthorResponse update(@PathVariable Long id,
                                           @Valid @RequestBody UpdateCandidateAuthorRequest request) {
        return candidates.updateAuthor(id, request);
    }
}
