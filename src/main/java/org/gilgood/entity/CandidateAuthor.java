package org.gilgood.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "candidate_authors", uniqueConstraints =
        @UniqueConstraint(name = "uk_candidate_author_import_key", columnNames = "import_key"))
@Getter
@Setter
public class CandidateAuthor extends CandidateRecord {
    @Column(name = "full_name", nullable = false)
    private String fullName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "published_author_id", foreignKey = @ForeignKey(name = "fk_candidate_published_author"))
    private Author publishedAuthor;
}
