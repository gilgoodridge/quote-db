package org.gilgood.service;

import lombok.RequiredArgsConstructor;
import org.gilgood.entity.CandidateStatus;
import org.gilgood.exception.QuoteLinkedToCandidatesException;
import org.gilgood.repository.CandidateQuoteRepository;
import org.gilgood.repository.QuoteRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class QuoteDeletionService {
    private final QuoteRepository quotes;
    private final CandidateQuoteRepository candidates;

    @Transactional
    public void delete(Long id, CandidateStatus candidateStatus) {
        if (candidateStatus != null && candidateStatus != CandidateStatus.PENDING
                && candidateStatus != CandidateStatus.REJECTED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "candidateStatus must be PENDING or REJECTED");
        }
        var quote = quotes.findForDeletion(id);
        if (quote.isEmpty()) return;

        if (candidateStatus == null) {
            if (candidates.existsByPublishedQuote_Id(id)) {
                throw new QuoteLinkedToCandidatesException();
            }
        } else {
            candidates.unlinkPublishedQuote(id, candidateStatus);
        }
        quotes.delete(quote.get());
        quotes.flush();
    }
}
