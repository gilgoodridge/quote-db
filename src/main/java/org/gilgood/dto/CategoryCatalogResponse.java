package org.gilgood.dto;

import java.util.List;

public record CategoryCatalogResponse(
        List<CategoryResponse> tones,
        List<CategoryResponse> themes,
        List<CategoryResponse> forms,
        List<CategoryResponse> sources) {
}
