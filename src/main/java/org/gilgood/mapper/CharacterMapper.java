package org.gilgood.mapper;

import org.gilgood.dto.CharacterResponse;
import org.gilgood.dto.CreateCharacterRequest;
import org.gilgood.dto.UpdateCharacterRequest;
import org.gilgood.entity.Character;
import org.mapstruct.AfterMapping;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;

@Mapper(componentModel = "spring")
public interface CharacterMapper {
    @Mapping(target = "id", ignore = true)
    Character toEntity(CreateCharacterRequest request);

    @Mapping(target = "id", ignore = true)
    void updateEntity(UpdateCharacterRequest request, @MappingTarget Character character);

    CharacterResponse toResponse(Character character);

    @AfterMapping
    default void normalizeKnownAs(@MappingTarget Character character) {
        if (character.getKnownAs() != null && character.getKnownAs().isBlank()) {
            character.setKnownAs(null);
        }
    }
}
