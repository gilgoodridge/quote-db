package org.gilgood.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
public class QuoteResponse {
    private Long id;
    private String text;
    private LocalDate date;
    private String location;
    private String reference;
    private AuthorResponse author;

    @Schema(description = "The author's age at the time this quote was written or spoken")
    private Integer authorAgeAtQuote;
}
