package org.gilgood.dto;

public record SessionUserResponse(boolean authenticated, String name, String email) {
}
