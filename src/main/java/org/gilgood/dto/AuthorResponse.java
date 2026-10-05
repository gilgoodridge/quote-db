package org.gilgood.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
public class AuthorResponse {
    private Long id;
    private String givenName;
    private String familyName;
    private String preferredName;
    private LocalDate dateOfBirth;
    private LocalDate dateOfDeath;
    private String placeOfBirth;
    private String nationality;
    private String bio;
    private String pseudonym;

    @Schema(description = "Author's current age, or age at death if deceased")
    private Integer age;
}
