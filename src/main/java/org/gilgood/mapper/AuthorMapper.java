package org.gilgood.mapper;

import org.gilgood.dto.AuthorResponse;
import org.gilgood.dto.CreateAuthorRequest;
import org.gilgood.dto.UpdateAuthorRequest;
import org.gilgood.entity.Author;
import org.mapstruct.AfterMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;

import java.time.LocalDate;

@Mapper(componentModel = "spring")
public interface AuthorMapper {
    Author toEntity(CreateAuthorRequest request);

    void updateEntity(UpdateAuthorRequest request, @MappingTarget Author author);

    @Mapping(target = "age", expression = "java(computeAge(author.getDateOfBirth(), author.getDateOfDeath()))")
    AuthorResponse toResponse(Author author);

    @AfterMapping
    default void normalizeKnownAs(@MappingTarget Author author) {
        if (author.getKnownAs() != null && author.getKnownAs().isBlank()) {
            author.setKnownAs(null);
        }
    }

    default Integer computeAge(LocalDate dateOfBirth, LocalDate dateOfDeath) {
        if (dateOfBirth == null) {
            return null;
        }

        LocalDate referenceDate = dateOfDeath != null ? dateOfDeath : LocalDate.now();
        int age = referenceDate.getYear() - dateOfBirth.getYear();

        if (referenceDate.getMonthValue() < dateOfBirth.getMonthValue() ||
                (referenceDate.getMonthValue() == dateOfBirth.getMonthValue() &&
                        referenceDate.getDayOfMonth() < dateOfBirth.getDayOfMonth())) {
            age--;
        }

        return age;
    }
}
