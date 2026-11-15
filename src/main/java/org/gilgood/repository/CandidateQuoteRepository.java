package org.gilgood.repository;

import org.gilgood.entity.CandidateQuote;
import org.gilgood.entity.CandidateStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface CandidateQuoteRepository extends JpaRepository<CandidateQuote, Long> {
    Optional<CandidateQuote> findByImportKey(String importKey);

    boolean existsByPublishedQuote_Id(Long publishedQuoteId);

    @Query("select q from CandidateQuote q where (:status is null or q.status = :status) " +
            "and (:candidateAuthorId is null or q.candidateAuthor.id = :candidateAuthorId)")
    Page<CandidateQuote> findCandidates(CandidateStatus status, Long candidateAuthorId, Pageable pageable);
}
