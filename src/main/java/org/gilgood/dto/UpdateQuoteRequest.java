package org.gilgood.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Data
@NoArgsConstructor
public class UpdateQuoteRequest {
    private String text;
    private LocalDate date;
    private String location;
    private String reference;
    private Long authorId;
}
