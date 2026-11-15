package org.gilgood.repository;

import org.gilgood.entity.Author;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@DataJpaTest(properties = {
        "spring.flyway.enabled=false",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class AuthorRepositoryTest {
    private static final LocalDate BIRTH_DATE = LocalDate.of(1775, 12, 16);

    @Autowired
    private AuthorRepository repository;

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void databaseRejectsDuplicateFullNameOrKnownAsOnSameBirthDate(boolean sameFullName) {
        repository.saveAndFlush(author("Jane Austen", "Jane", BIRTH_DATE));
        Author duplicate = sameFullName
                ? author("Jane Austen", "Different alias", BIRTH_DATE)
                : author("Different full name", "Jane", BIRTH_DATE);
        assertThrows(DataIntegrityViolationException.class, () -> repository.saveAndFlush(duplicate));
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void databaseRejectsUpdateThatCreatesDuplicate(boolean sameFullName) {
        repository.saveAndFlush(author("Jane Austen", "Jane", BIRTH_DATE));
        Author other = repository.saveAndFlush(author("Another author", "Another alias", BIRTH_DATE));
        if (sameFullName) {
            other.setFullName("Jane Austen");
        } else {
            other.setKnownAs("Jane");
        }
        assertThrows(DataIntegrityViolationException.class, () -> repository.saveAndFlush(other));
    }

    @ParameterizedTest
    @ValueSource(booleans = {true, false})
    void databaseRejectsBirthDateUpdateThatCreatesDuplicate(boolean sameFullName) {
        repository.saveAndFlush(author("Jane Austen", "Jane", BIRTH_DATE));
        Author other = repository.saveAndFlush(sameFullName
                ? author("Jane Austen", "Another alias", BIRTH_DATE.plusDays(1))
                : author("Another author", "Jane", BIRTH_DATE.plusDays(1)));
        other.setDateOfBirth(BIRTH_DATE);
        assertThrows(DataIntegrityViolationException.class, () -> repository.saveAndFlush(other));
    }

    @Test
    void permitsDifferentBirthDatesMissingAliasesAndCrossFieldMatches() {
        repository.saveAndFlush(author("Jane Austen", "Jane", BIRTH_DATE));
        repository.saveAndFlush(author("Jane Austen", "Jane", BIRTH_DATE.plusDays(1)));
        repository.saveAndFlush(author("Other author", null, BIRTH_DATE));
        repository.saveAndFlush(author("Another author", null, BIRTH_DATE));
        repository.saveAndFlush(author("Jane", "Jane Austen", BIRTH_DATE));
        assertEquals(5, repository.count());
    }

    @Test
    void unchangedAuthorCanBeSavedAgain() {
        Author author = repository.saveAndFlush(author("Jane Austen", "Jane", BIRTH_DATE));
        author.setBio("Updated biography");
        repository.saveAndFlush(author);
        assertEquals(1, repository.count());
    }

    @Test
    void searchMatchesEitherNameIgnoringCaseAndCountsEachAuthorOnce() {
        Author first = repository.saveAndFlush(author("William Shakespeare", null, BIRTH_DATE));
        Author second = repository.saveAndFlush(author("Another SHAKESPEARE", "Shakespeare Junior", BIRTH_DATE));
        Author third = repository.saveAndFlush(author("Samuel Clemens", "The SHAKESPEARE of America", BIRTH_DATE));
        repository.saveAndFlush(author("Unrelated Author", null, BIRTH_DATE));

        var firstPage = repository.findByFullNameContainingIgnoreCaseOrKnownAsContainingIgnoreCase(
                "sHaKe", "sHaKe", PageRequest.of(0, 1, Sort.by("id")));
        var secondPage = repository.findByFullNameContainingIgnoreCaseOrKnownAsContainingIgnoreCase(
                "sHaKe", "sHaKe", PageRequest.of(1, 1, Sort.by("id")));
        var thirdPage = repository.findByFullNameContainingIgnoreCaseOrKnownAsContainingIgnoreCase(
                "sHaKe", "sHaKe", PageRequest.of(2, 1, Sort.by("id")));

        assertEquals(List.of(first), firstPage.getContent());
        assertEquals(List.of(second), secondPage.getContent());
        assertEquals(List.of(third), thirdPage.getContent());
        assertEquals(3, firstPage.getTotalElements());
        assertEquals(3, firstPage.getTotalPages());
        assertEquals(0, repository.findByFullNameContainingIgnoreCaseOrKnownAsContainingIgnoreCase(
                "missing", "missing", PageRequest.of(0, 20)).getTotalElements());
    }

    @ParameterizedTest
    @ValueSource(strings = {"%", "_", "\\"})
    void searchTreatsLikeWildcardsAsLiteralCharacters(String query) {
        Author match = repository.saveAndFlush(author("Name " + query + " literal", null, BIRTH_DATE));
        Author aliasMatch = repository.saveAndFlush(author("Alias author", "Alias " + query + " literal", BIRTH_DATE));
        repository.saveAndFlush(author("Name without special characters", null, BIRTH_DATE));
        assertEquals(List.of(match, aliasMatch), repository.findByFullNameContainingIgnoreCaseOrKnownAsContainingIgnoreCase(
                query, query, PageRequest.of(0, 20, Sort.by("id"))).getContent());
    }

    @Test
    void databaseRequiresBirthDate() {
        assertThrows(DataIntegrityViolationException.class,
                () -> repository.saveAndFlush(author("Jane Austen", null, null)));
    }

    private Author author(String fullName, String knownAs, LocalDate birthDate) {
        Author author = new Author(fullName);
        author.setKnownAs(knownAs);
        author.setDateOfBirth(birthDate);
        return author;
    }
}
