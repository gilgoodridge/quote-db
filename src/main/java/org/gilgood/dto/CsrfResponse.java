package org.gilgood.dto;

public record CsrfResponse(String token, String headerName) {
}
