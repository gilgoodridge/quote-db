package org.gilgood.dto;

import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.Set;

@Data
@NoArgsConstructor
public class UpdateQuoteRequest {
    private String text;
    private LocalDate date;
    private String location;
    private String reference;
    private Long authorId;
    private Set<Long> toneIds;
    private Set<Long> themeIds;
    private Set<Long> formIds;
    private Set<Long> sourceIds;
}
