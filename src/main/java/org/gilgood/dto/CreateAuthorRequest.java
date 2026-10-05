package org.gilgood.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateAuthorRequest {
    private String givenName;
    private String familyName;
    private String preferredName;
    private LocalDate dateOfBirth;
    private LocalDate dateOfDeath;
    private String placeOfBirth;
    private String nationality;
    private String bio;
    private String pseudonym;
}
