package org.gilgood.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ImportCandidateAuthorRequest extends ImportCandidateRequest {
    @NotBlank @Size(max = 255)
    private String fullName;
}
