package org.gilgood.mapper;

import org.gilgood.dto.CategoryResponse;
import org.gilgood.entity.QuoteCategory;
import org.mapstruct.Mapper;

import java.util.Collection;
import java.util.Comparator;
import java.util.List;

@Mapper(componentModel = "spring")
public interface CategoryMapper {
    CategoryResponse toResponse(QuoteCategory category);

    default List<CategoryResponse> toResponses(Collection<? extends QuoteCategory> categories) {
        return categories.stream()
                .sorted(Comparator.comparing(QuoteCategory::getId))
                .map(this::toResponse)
                .toList();
    }
}
