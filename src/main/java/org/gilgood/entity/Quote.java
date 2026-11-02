package org.gilgood.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.gilgood.search.QuoteSearchText;
import org.hibernate.annotations.BatchSize;

import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "quotes")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Quote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "text", nullable = false, length = 2048)
    private String text;

    @Column(name = "search_text", nullable = false, columnDefinition = "text")
    private String searchText;

    @Column(name = "date")
    private LocalDate date;

    @Column(name = "location")
    private String location;

    @Column(name = "reference")
    private String reference;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "author_id", nullable = false)
    private Author author;

    @ManyToMany
    @JoinTable(name = "quote_tones", joinColumns = @JoinColumn(name = "quote_id"),
            inverseJoinColumns = @JoinColumn(name = "tone_id"))
    @BatchSize(size = 100)
    private Set<Tone> tones = new LinkedHashSet<>();

    @ManyToMany
    @JoinTable(name = "quote_themes", joinColumns = @JoinColumn(name = "quote_id"),
            inverseJoinColumns = @JoinColumn(name = "theme_id"))
    @BatchSize(size = 100)
    private Set<Theme> themes = new LinkedHashSet<>();

    @ManyToMany
    @JoinTable(name = "quote_forms", joinColumns = @JoinColumn(name = "quote_id"),
            inverseJoinColumns = @JoinColumn(name = "form_id"))
    @BatchSize(size = 100)
    private Set<Form> forms = new LinkedHashSet<>();

    @ManyToMany
    @JoinTable(name = "quote_sources", joinColumns = @JoinColumn(name = "quote_id"),
            inverseJoinColumns = @JoinColumn(name = "source_id"))
    @BatchSize(size = 100)
    private Set<Source> sources = new LinkedHashSet<>();

    public Quote(String text, Author author) {
        this.text = text;
        this.author = author;
    }

    @PrePersist
    @PreUpdate
    private void updateSearchText() {
        searchText = QuoteSearchText.normalize(text);
    }
}
