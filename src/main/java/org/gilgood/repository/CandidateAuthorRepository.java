package org.gilgood.repository;

import org.gilgood.entity.CandidateAuthor;
import org.gilgood.entity.CandidateStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CandidateAuthorRepository extends JpaRepository<CandidateAuthor, Long> {
    Optional<CandidateAuthor> findByImportKey(String importKey);
    Page<CandidateAuthor> findByStatus(CandidateStatus status, Pageable pageable);
}
