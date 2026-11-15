package org.gilgood.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@MappedSuperclass
@Getter
@Setter
public abstract class CandidateRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "import_key", nullable = false, length = 128, updatable = false)
    private String importKey;

    @Column(nullable = false, length = 64, updatable = false)
    private String source;

    @Column(name = "source_page_id", nullable = false, updatable = false)
    private Long sourcePageId;

    @Column(name = "source_revision_id", nullable = false, updatable = false)
    private Long sourceRevisionId;

    @Column(name = "dump_date", nullable = false, updatable = false)
    private LocalDate dumpDate;

    @Column(name = "source_title", nullable = false, updatable = false)
    private String sourceTitle;

    @Column(name = "source_url", nullable = false, length = 2048, updatable = false)
    private String sourceUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private CandidateStatus status = CandidateStatus.PENDING;
}
