package org.gilgood.dto;

import lombok.Data;

@Data
public class CharacterResponse {
    private Long id;
    private String fullName;
    private String knownAs;
    private String description;
    private String workTitle;
}
