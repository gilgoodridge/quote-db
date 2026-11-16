package org.gilgood.service;

import lombok.RequiredArgsConstructor;
import org.gilgood.dto.*;
import org.gilgood.entity.*;
import org.gilgood.mapper.AuthorMapper;
import org.gilgood.mapper.CandidateMapper;
import org.gilgood.mapper.QuoteMapper;
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
    private final AuthorMapper authorMapper;
    private final QuoteMapper quoteMapper;

    @Transactional(readOnly = true)
    public PagedModel<CandidateAuthorResponse> listAuthors(CandidateStatus status, Pageable pageable) {
        requireAuthorStatus(status);
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
        var candidateAuthor = candidateAuthors.findByIdForUpdate(request.getCandidateAuthorId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "candidateAuthorId does not identify an existing candidate author"));
        if (candidateAuthor.getStatus() == CandidateStatus.REJECTED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cannot import a quote for a rejected candidate author");
        }
        var candidate = mapper.toEntity(request);
        candidate.setCandidateAuthor(candidateAuthor);
        return mapper.toResponse(candidateQuotes.saveAndFlush(candidate));
    }

    public CandidateBatchResponse importBatch(ImportCandidateBatchRequest request) {
        var importedAuthors = request.getAuthors().stream().map(this::importAuthor).toList();
        var importedQuotes = request.getQuotes().stream().map(quote -> {
            var parent = candidateAuthors.findByImportKey(quote.getCandidateAuthorImportKey())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "candidateAuthorImportKey does not identify an existing candidate author: "
                                    + quote.getCandidateAuthorImportKey()));
            return importQuote(mapper.toImportRequest(quote, parent.getId()));
        }).toList();
        return new CandidateBatchResponse(importedAuthors, importedQuotes);
    }

    public CandidateAuthorResponse updateAuthor(Long id, UpdateCandidateAuthorRequest request) {
        requireAuthorStatus(request.getStatus());
        var candidate = findAuthorForUpdate(id);
        var published = request.getPublishedAuthorId() == null ? null
                : authors.findById(request.getPublishedAuthorId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "publishedAuthorId does not identify an existing author"));
        mapper.updateEntity(request, candidate);
        candidate.setPublishedAuthor(published);
        return mapper.toResponse(candidateAuthors.saveAndFlush(candidate));
    }

    public CandidateAuthorPromotionResponse promoteNewAuthor(Long id, CreateAuthorRequest request) {
        var candidate = findAuthorForUpdate(id);
        if (candidate.getPublishedAuthor() != null) {
            var published = candidate.getPublishedAuthor();
            if (candidate.getStatus() != CandidateStatus.REJECTED
                    && candidate.getStatus() != CandidateStatus.APPROVED) {
                candidate.setFullName(published.getFullName());
                candidate.setStatus(CandidateStatus.APPROVED);
                candidateAuthors.saveAndFlush(candidate);
            }
            return authorPromotionResponse(candidate, published);
        }

        var published = authors.saveAndFlush(authorMapper.toEntity(request));
        candidate.setFullName(published.getFullName());
        candidate.setStatus(CandidateStatus.APPROVED);
        candidate.setPublishedAuthor(published);
        candidateAuthors.saveAndFlush(candidate);
        return authorPromotionResponse(candidate, published);
    }

    public CandidateAuthorPromotionResponse promoteExistingAuthor(
            Long id, LinkCandidateAuthorRequest request) {
        var candidate = findAuthorForUpdate(id);
        if (candidate.getPublishedAuthor() != null) {
                var published = candidate.getPublishedAuthor();
                if (candidate.getStatus() != CandidateStatus.REJECTED
                        && candidate.getStatus() != CandidateStatus.APPROVED) {
                    candidate.setFullName(published.getFullName());
                    candidate.setStatus(CandidateStatus.APPROVED);
                    candidateAuthors.saveAndFlush(candidate);
                }
                return authorPromotionResponse(candidate, published);
            }

        var published = authors.findById(request.getPublishedAuthorId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "publishedAuthorId does not identify an existing author"));
        candidate.setFullName(published.getFullName());
        candidate.setStatus(CandidateStatus.APPROVED);
        candidate.setPublishedAuthor(published);
        candidateAuthors.saveAndFlush(candidate);
        return authorPromotionResponse(candidate, published);
    }

    public CandidateQuotePromotionResponse promoteQuote(Long id, CreateQuoteRequest request) {
        Long candidateAuthorId = candidateQuotes.findCandidateAuthorIdById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Candidate quote not found with ID: " + id));
        var candidateAuthor = candidateAuthors.findByIdForUpdate(candidateAuthorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Candidate author not found with ID: " + candidateAuthorId));
        var candidate = candidateQuotes.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Candidate quote not found with ID: " + id));
        if (candidate.getPublishedQuote() != null) {
            var published = candidate.getPublishedQuote();
            if (candidate.getStatus() != CandidateStatus.REJECTED
                    && candidate.getStatus() != CandidateStatus.APPROVED) {
                candidate.setText(published.getText());
                candidate.setStatus(CandidateStatus.APPROVED);
                candidateQuotes.saveAndFlush(candidate);
            }
            return quotePromotionResponse(candidate, published);
        }
        if (candidateAuthor.getStatus() == CandidateStatus.REJECTED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Cannot promote a quote whose candidate author was rejected");
        }

        var published = quotes.saveAndFlush(quoteMapper.toEntity(request));
        candidate.setText(published.getText());
        candidate.setStatus(CandidateStatus.APPROVED);
        candidate.setPublishedQuote(published);
        candidateQuotes.saveAndFlush(candidate);
        return quotePromotionResponse(candidate, published);
    }

    public CandidateAuthorResponse snoozeAuthorQuotes(Long id) {
        var candidate = findAuthorForUpdate(id);
        candidateQuotes.updateStatusByCandidateAuthorId(id, CandidateStatus.SNOOZED);
        return mapper.toResponse(candidate);
    }

    public CandidateAuthorResponse rejectAuthorAndQuotes(Long id) {
        var candidate = findAuthorForUpdate(id);
        candidate.setStatus(CandidateStatus.REJECTED);
        candidateQuotes.updateStatusByCandidateAuthorId(id, CandidateStatus.REJECTED);
        return mapper.toResponse(candidateAuthors.saveAndFlush(candidate));
    }

    public CandidateQuoteResponse updateQuote(Long id, UpdateCandidateQuoteRequest request) {
        Long candidateAuthorId = candidateQuotes.findCandidateAuthorIdById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Candidate quote not found with ID: " + id));
        candidateAuthors.findByIdForUpdate(candidateAuthorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Candidate author not found with ID: " + candidateAuthorId));
        var candidate = candidateQuotes.findByIdForUpdate(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Candidate quote not found with ID: " + id));
        var published = request.getPublishedQuoteId() == null ? null
                : quotes.findById(request.getPublishedQuoteId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "publishedQuoteId does not identify an existing quote"));
        mapper.updateEntity(request, candidate);
        candidate.setPublishedQuote(published);
        return mapper.toResponse(candidateQuotes.saveAndFlush(candidate));
    }

    private CandidateAuthorPromotionResponse authorPromotionResponse(CandidateAuthor candidate, Author author) {
        return new CandidateAuthorPromotionResponse(mapper.toResponse(candidate), authorMapper.toResponse(author));
    }

    private CandidateQuotePromotionResponse quotePromotionResponse(CandidateQuote candidate, Quote quote) {
        return new CandidateQuotePromotionResponse(mapper.toResponse(candidate), quoteMapper.toResponse(quote));
    }

    private CandidateAuthor findAuthor(Long id) {
        return candidateAuthors.findById(id).orElseThrow(() ->
                new IllegalArgumentException("Candidate author not found with ID: " + id));
    }

    private CandidateAuthor findAuthorForUpdate(Long id) {
        return candidateAuthors.findByIdForUpdate(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Candidate author not found with ID: " + id));
    }

    private CandidateQuote findQuote(Long id) {
        return candidateQuotes.findById(id).orElseThrow(() ->
                new IllegalArgumentException("Candidate quote not found with ID: " + id));
    }

    private void requireAuthorStatus(CandidateStatus status) {
        if (status == CandidateStatus.SNOOZED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "SNOOZED is only valid for candidate quotes");
        }
    }

    private void verifyIdentity(CandidateRecord candidate, ImportCandidateRequest request) {
        if (!candidate.getSource().equals(request.getSource())
                || !candidate.getSourcePageId().equals(request.getSourcePageId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "importKey already belongs to a different source page");
        }
    }
}
