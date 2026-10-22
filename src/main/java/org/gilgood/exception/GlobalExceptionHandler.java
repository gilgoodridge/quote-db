package org.gilgood.exception;

import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseBody;

@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(DataIntegrityViolationException.class)
    @ResponseBody
    public ResponseEntity<String> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        for (Throwable cause = ex; cause != null; cause = cause.getCause()) {
            if (cause instanceof ConstraintViolationException violation) {
                String name = violation.getConstraintName();
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
