package org.gilgood.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class ImportCandidateBatchRequest {
    @NotNull @Size(max = 100)
    private List<@NotNull @Valid ImportCandidateAuthorRequest> authors;
    @NotNull @Size(max = 100)
    private List<@NotNull @Valid QuoteRequest> quotes;

    @AssertTrue(message = "batch must contain at least one candidate")
    public boolean isNonEmpty() {
        return authors != null && quotes != null && (!authors.isEmpty() || !quotes.isEmpty());
    }

    @Getter
    @Setter
    public static class QuoteRequest extends ImportCandidateRequest {
        @NotBlank
        @Pattern(regexp = "[a-z0-9][a-z0-9:._/-]{0,127}")
        private String candidateAuthorImportKey;
        @NotBlank @Size(max = 2048)
        private String text;
        @NotBlank @Size(max = 16000)
        private String rawWikitext;
        @Size(max = 16000)
        private String sourceNotes;
    }
}
