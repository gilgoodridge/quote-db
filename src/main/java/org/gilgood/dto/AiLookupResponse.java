package org.gilgood.dto;

public record AiLookupResponse(Status status, String value) {
    public enum Status {
        FOUND, UNKNOWN
    }
}
