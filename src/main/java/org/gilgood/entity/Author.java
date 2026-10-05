package org.gilgood.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

@Entity
@Table(name = "authors")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Author {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToMany(mappedBy = "author", fetch = FetchType.LAZY)
    private List<Quote> quotes;

    @Column(name = "family_name", nullable = false)
    private String familyName;

    @Column(name = "given_name", nullable = false)
    private String givenName;

    @Column(name = "preferred_name")
    private String preferredName;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(name = "date_of_death")
    private LocalDate dateOfDeath;

    @Column(name = "place_of_birth")
    private String placeOfBirth;

    @Column(name = "nationality")
    private String nationality;

    @Column(name = "bio", length = 1024)
    private String bio;

    @Column(name = "pseudonym")
    private String pseudonym;

    public Author(String familyName, String givenName) {
        this.familyName = familyName;
        this.givenName = givenName;
    }
}

