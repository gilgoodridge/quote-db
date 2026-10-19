package org.gilgood.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
public class AuthorResponse {
    private Long id;
    private String fullName;
    private String knownAs;
    private LocalDate dateOfBirth;
    private LocalDate dateOfDeath;
    private String placeOfBirth;
    private String nationality;
    private String bio;
    @Schema(description = "Author's current age, or age at death if deceased")
    private Integer age;
}
