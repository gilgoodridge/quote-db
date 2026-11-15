package org.gilgood.dto;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.time.LocalDate;

@Data
public abstract class ImportCandidateRequest {
    @NotBlank
    @Pattern(regexp = "[a-z0-9][a-z0-9:._/-]{0,127}")
    private String importKey;
    @NotBlank @Size(max = 64)
    private String source;
    @NotNull @Positive
    private Long sourcePageId;
    @NotNull @Positive
    private Long sourceRevisionId;
    @NotNull
    private LocalDate dumpDate;
    @NotBlank @Size(max = 255)
    private String sourceTitle;
    @NotBlank @Size(max = 2048) @Pattern(regexp = "https?://\\S+")
    private String sourceUrl;
}
