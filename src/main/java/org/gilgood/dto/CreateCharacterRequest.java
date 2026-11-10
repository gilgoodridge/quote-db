package org.gilgood.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateCharacterRequest {
    @NotBlank
    @Size(max = 255)
    private String fullName;
    @Size(max = 255)
    private String knownAs;
    @Size(max = 1024)
    private String description;
    @Size(max = 255)
    private String workTitle;
}
