package org.gilgood.exception;

import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

@ControllerAdvice
public class GlobalExceptionHandler {

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
    public ResponseEntity<String> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        for (Throwable cause = ex; cause != null; cause = cause.getCause()) {
            if (cause instanceof ConstraintViolationException violation) {
                String name = violation.getConstraintName();
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
