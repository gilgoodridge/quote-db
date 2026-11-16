package org.gilgood.repository;

import jakarta.persistence.LockModeType;
import org.gilgood.entity.CandidateQuote;
import org.gilgood.entity.CandidateStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface CandidateQuoteRepository extends JpaRepository<CandidateQuote, Long> {
    Optional<CandidateQuote> findByImportKey(String importKey);

    boolean existsByPublishedQuote_Id(Long publishedQuoteId);

    @Modifying
    @Query("update CandidateQuote q set q.status = :status, q.publishedQuote = null " +
            "where q.publishedQuote.id = :publishedQuoteId")
    int unlinkPublishedQuote(Long publishedQuoteId, CandidateStatus status);

    @Modifying
    @Query("update CandidateQuote q set q.status = :status where q.candidateAuthor.id = :candidateAuthorId")
    int updateStatusByCandidateAuthorId(Long candidateAuthorId, CandidateStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select candidate from CandidateQuote candidate where candidate.id = :id")
    Optional<CandidateQuote> findByIdForUpdate(@Param("id") Long id);

    @Query("select candidate.candidateAuthor.id from CandidateQuote candidate where candidate.id = :id")
    Optional<Long> findCandidateAuthorIdById(@Param("id") Long id);

    @Query("select q from CandidateQuote q where (:status is null or q.status = :status) " +
            "and (:candidateAuthorId is null or q.candidateAuthor.id = :candidateAuthorId)")
    Page<CandidateQuote> findCandidates(CandidateStatus status, Long candidateAuthorId, Pageable pageable);
}
