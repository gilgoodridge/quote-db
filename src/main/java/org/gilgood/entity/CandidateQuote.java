package org.gilgood.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "candidate_quotes", uniqueConstraints =
        @UniqueConstraint(name = "uk_candidate_quote_import_key", columnNames = "import_key"))
@Getter
@Setter
public class CandidateQuote extends CandidateRecord {
    @Column(nullable = false, length = 2048)
    private String text;

    @Column(name = "raw_wikitext", nullable = false, columnDefinition = "TEXT", updatable = false)
    private String rawWikitext;

    @Column(name = "source_notes", columnDefinition = "TEXT", updatable = false)
    private String sourceNotes;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "candidate_author_id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_candidate_quote_author"))
    private CandidateAuthor candidateAuthor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "published_quote_id", foreignKey = @ForeignKey(name = "fk_candidate_published_quote"))
    private Quote publishedQuote;
}
