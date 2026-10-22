package org.gilgood.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateAuthorRequest {
    @NotBlank
    private String fullName;
    private String knownAs;
    @NotNull(message = "Date of birth is required")
    private LocalDate dateOfBirth;
    private LocalDate dateOfDeath;
    private String placeOfBirth;
    private String nationality;
    private String bio;
}
