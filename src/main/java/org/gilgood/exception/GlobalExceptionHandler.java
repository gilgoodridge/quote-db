package org.gilgood.exception;

import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;

@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(HttpMessageNotReadableException.class)
    @ResponseBody
    public ResponseEntity<String> handleInvalidBody(HttpMessageNotReadableException ex) {
        return ResponseEntity.badRequest().body("Invalid request body: check field values and supported types");
    }

    @ExceptionHandler(QuoteLinkedToCandidatesException.class)
    @ResponseBody
    public ResponseEntity<ProblemDetail> handleQuoteLinkedToCandidates(QuoteLinkedToCandidatesException ex) {
        var problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
        problem.setType(URI.create("urn:quote-db:problem:quote-linked-to-candidates"));
        problem.setTitle("Quote linked to candidates");
        problem.setProperty("code", "QUOTE_LINKED_TO_CANDIDATES");
        return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    @ResponseBody
    public ResponseEntity<String> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return ResponseEntity.badRequest().body("Invalid value for parameter: " + ex.getName());
    }

    @ExceptionHandler(ResponseStatusException.class)
    @ResponseBody
    public ResponseEntity<String> handleResponseStatus(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode()).body(ex.getReason());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    @ResponseBody
    public ResponseEntity<?> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        for (Throwable cause = ex; cause != null; cause = cause.getCause()) {
            if (cause instanceof ConstraintViolationException violation) {
                String name = violation.getConstraintName();
                if (name != null && name.toLowerCase(java.util.Locale.ROOT).contains("fk_candidate_published_quote")) {
                    return handleQuoteLinkedToCandidates(new QuoteLinkedToCandidatesException());
                }
                if (name != null && name.toLowerCase(java.util.Locale.ROOT).contains("uk_candidate_")) {
                    return ResponseEntity.status(HttpStatus.CONFLICT)
                            .body("The importKey already exists; retry the import to retrieve the existing candidate");
                }
                if (name != null && name.toLowerCase(java.util.Locale.ROOT).contains("fk_candidate_")) {
                    return ResponseEntity.status(HttpStatus.CONFLICT)
                            .body("The record is linked to candidate review data; clear the link before deleting");
                }
                if (name != null && name.toLowerCase(java.util.Locale.ROOT).contains("fk_quote_character")) {
                    return ResponseEntity.status(HttpStatus.CONFLICT)
                            .body("The character is linked to quotes; unlink it before deleting");
                }
                if (name != null && (name.equals("uk_author_full_name_birth")
                        || name.endsWith(".uk_author_full_name_birth")
                        || name.equals("uk_author_known_as_birth")
                        || name.endsWith(".uk_author_known_as_birth"))) {
                    return ResponseEntity.status(HttpStatus.CONFLICT).body("The author already exists");
                }
            }
        }
        throw ex;
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseBody
    @SuppressWarnings("unused")
    public ResponseEntity<String> handleNotFound(IllegalArgumentException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ex.getMessage());
    }
}
