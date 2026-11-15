package org.gilgood.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CandidateAuthorResponse extends CandidateResponse {
    private String fullName;
    private Long publishedAuthorId;
}
