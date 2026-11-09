package org.gilgood.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import org.gilgood.dto.AuthorResponse;
import org.gilgood.dto.CreateAuthorRequest;
import org.gilgood.dto.UpdateAuthorRequest;
import org.gilgood.entity.Author;
import org.gilgood.mapper.AuthorMapper;
import org.gilgood.repository.AuthorRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PagedModel;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/authors")
public class AuthorController {

    @Autowired
    private AuthorRepository authorRepository;

    @Autowired
    private AuthorMapper authorMapper;

    @GetMapping
    @Operation(summary = "List authors",
            description = "Optionally searches fullName using case-insensitive substring matching. " +
                    "Omitted or blank query preserves normal listing behavior. " +
                    "Returns a page ordered by ID ascending. page is zero-based (default 0); " +
                    "size defaults to 20 and must be between 1 and 100.")
    public PagedModel<AuthorResponse> listAuthors(
            @Parameter(description = "Plain-text partial name; searches fullName only")
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        var pageable = Pagination.request(page, size).withSort(Sort.by("id"));
        var authors = query != null && !query.isBlank()
                ? authorRepository.findByFullNameContainingIgnoreCase(query.trim(), pageable)
                : authorRepository.findAll(pageable);
        return new PagedModel<>(authors.map(authorMapper::toResponse));
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
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Author created"),
            @ApiResponse(responseCode = "400", description = "Missing required fullName or dateOfBirth"),
            @ApiResponse(responseCode = "409", description = "The author already exists")
    })
    public AuthorResponse addAuthor(@Valid @RequestBody CreateAuthorRequest request) {
        Author author = authorMapper.toEntity(request);
        Author saved = authorRepository.saveAndFlush(author);
        return authorMapper.toResponse(saved);
    }

    @PutMapping("/{id}")
    @Operation(
            summary = "Replace author (full update)",
            description = "Replaces the entire author record. " +
                    "Any optional fields omitted or set to null will be deleted from the database. " +
                    "The required fullName and dateOfBirth fields must be provided; missing either returns 400 Bad Request."
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Author updated successfully"),
            @ApiResponse(responseCode = "400", description = "Missing required fields"),
            @ApiResponse(responseCode = "404", description = "Author not found"),
            @ApiResponse(responseCode = "409", description = "The author already exists")
    })
    public AuthorResponse updateAuthor(@PathVariable Long id, @Valid @RequestBody UpdateAuthorRequest request) {
        Author author = authorRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Author not found with ID: " + id));
        authorMapper.updateEntity(request, author);
        Author updated = authorRepository.saveAndFlush(author);
        return authorMapper.toResponse(updated);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Delete author")
    public void deleteAuthor(@PathVariable Long id) {
        authorRepository.deleteById(id);
    }
}
