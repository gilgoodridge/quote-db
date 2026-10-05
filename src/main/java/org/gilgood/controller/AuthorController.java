package org.gilgood.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import org.gilgood.dto.AuthorResponse;
import org.gilgood.dto.CreateAuthorRequest;
import org.gilgood.dto.UpdateAuthorRequest;
import org.gilgood.entity.Author;
import org.gilgood.mapper.AuthorMapper;
import org.gilgood.repository.AuthorRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/authors")
public class AuthorController {

    @Autowired
    private AuthorRepository authorRepository;

    @Autowired
    private AuthorMapper authorMapper;

    @GetMapping
    @Operation(summary = "List all authors")
    public List<AuthorResponse> listAuthors() {
        return authorRepository.findAll()
                .stream()
                .map(authorMapper::toResponse)
                .collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get an author by ID")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Author found"),
            @ApiResponse(responseCode = "404", description = "Author not found")
    })
    public AuthorResponse getAuthor(@PathVariable Long id) {
        Author author = authorRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Author not found with ID: " + id));
        return authorMapper.toResponse(author);
    }

    @PostMapping
    @Operation(summary = "Create new author")
    public AuthorResponse addAuthor(@RequestBody CreateAuthorRequest request) {
        Author author = authorMapper.toEntity(request);
        Author saved = authorRepository.save(author);
        return authorMapper.toResponse(saved);
    }

    @PutMapping("/{id}")
    @Operation(
            summary = "Replace author (full update)",
            description = "Replaces the entire author record. " +
                    "Any optional fields omitted or set to null will be deleted from the database. " +
                    "Required fields (givenName, familyName) must be provided; missing required fields will return 400 Bad Request."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Author updated successfully"),
            @ApiResponse(responseCode = "400", description = "Missing required fields"),
            @ApiResponse(responseCode = "404", description = "Author not found")
    })
    public AuthorResponse updateAuthor(@PathVariable Long id, @RequestBody UpdateAuthorRequest request) {
        Author author = authorRepository.getReferenceById(id);
        authorMapper.updateEntity(request, author);
        Author updated = authorRepository.save(author);
        return authorMapper.toResponse(updated);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete author")
    public void deleteAuthor(@PathVariable Long id) {
        authorRepository.deleteById(id);
    }
}
