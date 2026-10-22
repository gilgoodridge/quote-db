package org.gilgood.repository;

import org.gilgood.entity.Author;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest(properties = {
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
