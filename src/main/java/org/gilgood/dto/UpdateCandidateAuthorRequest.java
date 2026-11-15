package org.gilgood.dto;

import jakarta.validation.constraints.*;
import lombok.Data;
import org.gilgood.entity.CandidateStatus;

@Data
public class UpdateCandidateAuthorRequest {
    @NotBlank @Size(max = 255)
    private String fullName;
    @NotNull
    private CandidateStatus status;
    @Positive
    private Long publishedAuthorId;
}
