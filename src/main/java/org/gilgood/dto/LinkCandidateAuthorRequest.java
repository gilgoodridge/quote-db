package org.gilgood.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
public class LinkCandidateAuthorRequest {
    @NotNull
    @Positive
    private Long publishedAuthorId;
}
