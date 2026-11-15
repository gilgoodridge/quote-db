package org.gilgood.dto;

import lombok.Data;
import org.gilgood.entity.CandidateStatus;

import java.time.LocalDate;

@Data
public abstract class CandidateResponse {
    private Long id;
    private String importKey;
    private String source;
    private Long sourcePageId;
    private Long sourceRevisionId;
    private LocalDate dumpDate;
    private String sourceTitle;
    private String sourceUrl;
    private CandidateStatus status;
}
