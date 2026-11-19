package org.gilgood.dto;

public record SessionUserResponse(boolean authenticated, boolean editor, String name, String email, String subject) {
}
