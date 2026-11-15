package org.gilgood.exception;

import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ProblemDetail;

import java.sql.SQLException;

import static org.junit.jupiter.api.Assertions.*;

class GlobalExceptionHandlerTest {
    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void candidateQuoteForeignKeyRaceReturnsTheSameTypedProblem() {
        var exception = violation("quote_db.fk_candidate_published_quote");
        var response = handler.handleDataIntegrityViolation(exception);
        assertEquals(409, response.getStatusCode().value());
        var problem = assertInstanceOf(ProblemDetail.class, response.getBody());
        assertEquals("urn:quote-db:problem:quote-linked-to-candidates", problem.getType().toString());
        assertEquals("QUOTE_LINKED_TO_CANDIDATES", problem.getProperties().get("code"));
        assertEquals("Quote is linked to candidate review data", problem.getDetail());
    }

    @Test
    void otherForeignKeysDoNotReturnTheCandidateQuoteProblem() {
        var character = handler.handleDataIntegrityViolation(violation("fk_quote_character"));
        assertEquals(409, character.getStatusCode().value());
        assertInstanceOf(String.class, character.getBody());
        var author = handler.handleDataIntegrityViolation(violation("fk_candidate_published_author"));
        assertEquals(409, author.getStatusCode().value());
        assertInstanceOf(String.class, author.getBody());
        var unknown = violation("fk_other");
        assertThrows(DataIntegrityViolationException.class, () -> handler.handleDataIntegrityViolation(unknown));
    }

    private DataIntegrityViolationException violation(String name) {
        return new DataIntegrityViolationException("Constraint violation",
                new ConstraintViolationException("Cannot delete parent", new SQLException(), "DELETE", name));
    }
}
