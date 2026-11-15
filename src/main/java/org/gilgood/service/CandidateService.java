package org.gilgood.service;

import lombok.RequiredArgsConstructor;
import org.gilgood.dto.*;
import org.gilgood.entity.*;
import org.gilgood.mapper.CandidateMapper;
import org.gilgood.repository.*;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PagedModel;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Transactional
public class CandidateService {
    private final CandidateAuthorRepository candidateAuthors;
    private final CandidateQuoteRepository candidateQuotes;
    private final AuthorRepository authors;
    private final QuoteRepository quotes;
    private final CandidateMapper mapper;

    @Transactional(readOnly = true)
    public PagedModel<CandidateAuthorResponse> listAuthors(CandidateStatus status, Pageable pageable) {
        var page = status == null ? candidateAuthors.findAll(pageable)
                : candidateAuthors.findByStatus(status, pageable);
        return new PagedModel<>(page.map(mapper::toResponse));
    }

    @Transactional(readOnly = true)
    public PagedModel<CandidateQuoteResponse> listQuotes(
            CandidateStatus status, Long candidateAuthorId, Pageable pageable) {
        if (candidateAuthorId != null && candidateAuthorId <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "candidateAuthorId must be positive");
        }
        return new PagedModel<>(candidateQuotes.findCandidates(status, candidateAuthorId, pageable)
                .map(mapper::toResponse));
    }

    @Transactional(readOnly = true)
    public CandidateAuthorResponse getAuthor(Long id) {
        return mapper.toResponse(findAuthor(id));
    }

    @Transactional(readOnly = true)
    public CandidateQuoteResponse getQuote(Long id) {
        return mapper.toResponse(findQuote(id));
    }

    public CandidateAuthorResponse importAuthor(ImportCandidateAuthorRequest request) {
        var existing = candidateAuthors.findByImportKey(request.getImportKey());
        if (existing.isPresent()) {
            verifyIdentity(existing.get(), request);
            return mapper.toResponse(existing.get());
        }
        return mapper.toResponse(candidateAuthors.saveAndFlush(mapper.toEntity(request)));
    }

    public CandidateQuoteResponse importQuote(ImportCandidateQuoteRequest request) {
        var existing = candidateQuotes.findByImportKey(request.getImportKey());
        if (existing.isPresent()) {
            verifyIdentity(existing.get(), request);
            if (!existing.get().getCandidateAuthor().getId().equals(request.getCandidateAuthorId())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "importKey already belongs to a different candidateAuthorId");
            }
            return mapper.toResponse(existing.get());
        }
        var candidateAuthor = candidateAuthors.findById(request.getCandidateAuthorId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "candidateAuthorId does not identify an existing candidate author"));
        var candidate = mapper.toEntity(request);
        candidate.setCandidateAuthor(candidateAuthor);
        return mapper.toResponse(candidateQuotes.saveAndFlush(candidate));
    }

    public CandidateAuthorResponse updateAuthor(Long id, UpdateCandidateAuthorRequest request) {
        var candidate = findAuthor(id);
        var published = request.getPublishedAuthorId() == null ? null
                : authors.findById(request.getPublishedAuthorId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "publishedAuthorId does not identify an existing author"));
        mapper.updateEntity(request, candidate);
        candidate.setPublishedAuthor(published);
        return mapper.toResponse(candidateAuthors.saveAndFlush(candidate));
    }

    public CandidateQuoteResponse updateQuote(Long id, UpdateCandidateQuoteRequest request) {
        var candidate = findQuote(id);
        var published = request.getPublishedQuoteId() == null ? null
                : quotes.findById(request.getPublishedQuoteId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "publishedQuoteId does not identify an existing quote"));
        mapper.updateEntity(request, candidate);
        candidate.setPublishedQuote(published);
        return mapper.toResponse(candidateQuotes.saveAndFlush(candidate));
    }

    private CandidateAuthor findAuthor(Long id) {
        return candidateAuthors.findById(id).orElseThrow(() ->
                new IllegalArgumentException("Candidate author not found with ID: " + id));
    }

    private CandidateQuote findQuote(Long id) {
        return candidateQuotes.findById(id).orElseThrow(() ->
                new IllegalArgumentException("Candidate quote not found with ID: " + id));
    }

    private void verifyIdentity(CandidateRecord candidate, ImportCandidateRequest request) {
        if (!candidate.getSource().equals(request.getSource())
                || !candidate.getSourcePageId().equals(request.getSourcePageId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "importKey already belongs to a different source page");
        }
    }
}
