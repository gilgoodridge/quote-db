package org.gilgood.dto;

import jakarta.validation.constraints.*;
import lombok.Data;
import org.gilgood.entity.CandidateStatus;

@Data
public class UpdateCandidateQuoteRequest {
    @NotBlank @Size(max = 2048)
    private String text;
    @NotNull
    private CandidateStatus status;
    @Positive
    private Long publishedQuoteId;
}
