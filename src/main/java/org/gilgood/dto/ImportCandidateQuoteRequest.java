package org.gilgood.dto;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ImportCandidateQuoteRequest extends ImportCandidateRequest {
    @NotNull @Positive
    private Long candidateAuthorId;
    @NotBlank @Size(max = 2048)
    private String text;
    @NotBlank @Size(max = 16000)
    private String rawWikitext;
    @Size(max = 16000)
    private String sourceNotes;
}
