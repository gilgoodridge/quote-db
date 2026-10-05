package org.gilgood.dto;

import lombok.Data;

import java.time.LocalDate;

@Data
public class CreateQuoteRequest {
    private String text;
    private LocalDate date;
    private String location;
    private String reference;
    private Long authorId;
}
