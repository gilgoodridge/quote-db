package org.gilgood.repository;

import jakarta.persistence.LockModeType;
import org.gilgood.entity.CandidateAuthor;
import org.gilgood.entity.CandidateStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface CandidateAuthorRepository extends JpaRepository<CandidateAuthor, Long> {
    Optional<CandidateAuthor> findByImportKey(String importKey);
    Page<CandidateAuthor> findByStatus(CandidateStatus status, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select candidate from CandidateAuthor candidate where candidate.id = :id")
    Optional<CandidateAuthor> findByIdForUpdate(@Param("id") Long id);
}
