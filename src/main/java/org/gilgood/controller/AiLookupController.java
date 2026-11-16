package org.gilgood.controller;

import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.gilgood.dto.AiLookupRequest;
import org.gilgood.dto.AiLookupResponse;
import org.gilgood.service.AiLookupService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AiLookupController {
    private final AiLookupService service;

    public AiLookupController(AiLookupService service) {
        this.service = service;
    }

    @PostMapping("/api/ai/lookups")
    @Operation(summary = "Look up an editorial suggestion using AI",
            description = "Requires authentication and CSRF. Select a supported lookup type and structured context. "
                    + "Supports AUTHOR_DATE_OF_BIRTH, AUTHOR_DATE_OF_DEATH, AUTHOR_PLACE_OF_BIRTH and AUTHOR_BIOGRAPHY "
                    + "with context.fullName. Returns FOUND with a string value (ISO for dates) or UNKNOWN. "
                    + "Never saves content. AI confidence is not a guarantee of accuracy.")
    public ResponseEntity<AiLookupResponse> lookup(@Valid @RequestBody AiLookupRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.lookup(request));
    }
}
