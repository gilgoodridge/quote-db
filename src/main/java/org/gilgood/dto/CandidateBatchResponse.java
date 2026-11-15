package org.gilgood.dto;

import java.util.List;

public record CandidateBatchResponse(
        List<CandidateAuthorResponse> authors, List<CandidateQuoteResponse> quotes) {
}
