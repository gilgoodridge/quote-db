package org.gilgood.exception;

public class QuoteLinkedToCandidatesException extends RuntimeException {
    public QuoteLinkedToCandidatesException() {
        super("Quote is linked to candidate review data");
    }
}
