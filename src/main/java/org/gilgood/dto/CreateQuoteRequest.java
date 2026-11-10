package org.gilgood.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.util.Set;

@Data
public class CreateQuoteRequest {
    private String text;
    private LocalDate date;
    private String location;
    private String reference;
    @NotNull
    private Long authorId;
    private Long characterId;
    private Set<Long> toneIds;
    private Set<Long> themeIds;
    private Set<Long> formIds;
    private Set<Long> sourceIds;
}
