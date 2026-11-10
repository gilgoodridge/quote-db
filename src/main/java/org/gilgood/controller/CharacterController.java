package org.gilgood.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import org.gilgood.dto.CharacterResponse;
import org.gilgood.dto.CreateCharacterRequest;
import org.gilgood.dto.UpdateCharacterRequest;
import org.gilgood.entity.Character;
import org.gilgood.mapper.CharacterMapper;
import org.gilgood.repository.CharacterRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PagedModel;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/characters")
public class CharacterController {
    @Autowired
    private CharacterRepository characterRepository;

    @Autowired
    private CharacterMapper characterMapper;

    @GetMapping
    @Operation(summary = "List characters",
            description = "Optionally searches fullName using case-insensitive literal substring matching. " +
                    "Omitted or blank query lists all characters. Ordered by ID ascending; page is zero-based " +
                    "(default 0), size defaults to 20 and must be between 1 and 100.")
    public PagedModel<CharacterResponse> listCharacters(
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var pageable = Pagination.request(page, size).withSort(Sort.by("id"));
        var characters = query != null && !query.isBlank()
                ? characterRepository.findByFullNameContainingIgnoreCase(query.trim(), pageable)
                : characterRepository.findAll(pageable);
        return new PagedModel<>(characters.map(characterMapper::toResponse));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get a character by ID")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Character found"),
            @ApiResponse(responseCode = "404", description = "Character not found")
    })
    public CharacterResponse getCharacter(@PathVariable Long id) {
        return characterMapper.toResponse(findCharacter(id));
    }

    @PostMapping
    @Operation(summary = "Create a fictional character",
            description = "fullName is required. knownAs, description and workTitle are optional.")
    public CharacterResponse addCharacter(@Valid @RequestBody CreateCharacterRequest request) {
        return characterMapper.toResponse(characterRepository.saveAndFlush(characterMapper.toEntity(request)));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Replace character (full update)",
            description = "fullName is required. Omitted or null optional fields are cleared.")
    public CharacterResponse updateCharacter(@PathVariable Long id,
                                             @Valid @RequestBody UpdateCharacterRequest request) {
        Character character = findCharacter(id);
        characterMapper.updateEntity(request, character);
        return characterMapper.toResponse(characterRepository.saveAndFlush(character));
    }

    @DeleteMapping("/{id}")
    @Transactional
    @Operation(summary = "Delete a character",
            description = "Unlink the character from all quotes before deleting it.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Character deleted"),
            @ApiResponse(responseCode = "404", description = "Character not found"),
            @ApiResponse(responseCode = "409", description = "Character is linked to quotes")
    })
    public void deleteCharacter(@PathVariable Long id) {
        characterRepository.delete(findCharacter(id));
        characterRepository.flush();
    }

    private Character findCharacter(Long id) {
        return characterRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Character not found with ID: " + id));
    }
}
