package org.gilgood.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

@Entity
@Table(name = "authors", uniqueConstraints = {
        @UniqueConstraint(name = "uk_author_full_name_birth", columnNames = {"full_name", "date_of_birth"}),
        @UniqueConstraint(name = "uk_author_known_as_birth", columnNames = {"known_as", "date_of_birth"})
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Author {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToMany(mappedBy = "author", fetch = FetchType.LAZY)
    private List<Quote> quotes;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    @Column(name = "known_as")
    private String knownAs;

    @Column(name = "date_of_birth", nullable = false)
    private LocalDate dateOfBirth;

    @Column(name = "date_of_death")
    private LocalDate dateOfDeath;

    @Column(name = "place_of_birth")
    private String placeOfBirth;

    @Column(name = "nationality")
    private String nationality;

    @Column(name = "bio", length = 1024)
    private String bio;

    public Author(String fullName) {
        this.fullName = fullName;
    }
}
