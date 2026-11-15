package org.gilgood.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CandidateQuoteResponse extends CandidateResponse {
    private String text;
    private String rawWikitext;
    private String sourceNotes;
    private Long candidateAuthorId;
    private Long publishedQuoteId;
}
