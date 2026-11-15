package org.gilgood.controller;

import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.gilgood.dto.CandidateBatchResponse;
import org.gilgood.dto.ImportCandidateBatchRequest;
import org.gilgood.service.CandidateService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/candidates/batch")
@RequiredArgsConstructor
public class CandidateBatchController {
    private final CandidateService candidates;

    @PostMapping
    @Operation(summary = "Import a batch of candidate authors and quotes", description =
            "Atomic import of up to 100 authors and 100 quotes, with at least one candidate. " +
                    "Quotes reference candidateAuthorImportKey from this batch or an earlier import. " +
                    "Returns stored DTOs in input order; existing keys never overwrite review data. " +
                    "Validation errors return 400, identity conflicts return 409; neither commits the batch.")
    public CandidateBatchResponse importBatch(@Valid @RequestBody ImportCandidateBatchRequest request) {
        return candidates.importBatch(request);
    }
}
