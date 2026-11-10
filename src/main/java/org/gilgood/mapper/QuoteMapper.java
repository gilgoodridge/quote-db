package org.gilgood.mapper;

import org.gilgood.dto.CreateQuoteRequest;
import org.gilgood.dto.QuoteResponse;
import org.gilgood.dto.UpdateQuoteRequest;
import org.gilgood.entity.Character;
import org.gilgood.entity.Quote;
import org.gilgood.repository.AuthorRepository;
import org.gilgood.repository.CharacterRepository;
import org.gilgood.service.CategoryService;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;

@Mapper(componentModel = "spring", uses = {CategoryMapper.class, CharacterMapper.class})
public abstract class QuoteMapper {

    @Autowired
    protected AuthorRepository authorRepository;

    @Autowired
    protected AuthorMapper authorMapper;

    @Autowired
    protected CategoryService categoryService;

    @Autowired
    protected CharacterRepository characterRepository;

    @Mapping(target = "character", expression = "java(resolveCharacter(request.getCharacterId()))")
    @Mapping(target = "tones", expression = "java(categoryService.resolveTones(request.getToneIds()))")
    @Mapping(target = "themes", expression = "java(categoryService.resolveThemes(request.getThemeIds()))")
    @Mapping(target = "forms", expression = "java(categoryService.resolveForms(request.getFormIds()))")
    @Mapping(target = "sources", expression = "java(categoryService.resolveSources(request.getSourceIds()))")
    @Mapping(target = "author", expression = "java(authorRepository.getReferenceById(request.getAuthorId()))")
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "searchText", ignore = true)
    public abstract Quote toEntity(CreateQuoteRequest request);

    @Mapping(target = "character", expression = "java(resolveCharacter(request.getCharacterId()))")
    @Mapping(target = "tones", expression = "java(categoryService.resolveTones(request.getToneIds()))")
    @Mapping(target = "themes", expression = "java(categoryService.resolveThemes(request.getThemeIds()))")
    @Mapping(target = "forms", expression = "java(categoryService.resolveForms(request.getFormIds()))")
    @Mapping(target = "sources", expression = "java(categoryService.resolveSources(request.getSourceIds()))")
    @Mapping(target = "author", expression = "java(authorRepository.getReferenceById(request.getAuthorId()))")
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "searchText", ignore = true)
    public abstract void updateEntity(UpdateQuoteRequest request, @MappingTarget Quote quote);

    @Mapping(target = "author", expression = "java(authorMapper.toResponse(quote.getAuthor()))")
    @Mapping(target = "authorAgeAtQuote", expression = "java(computeAuthorAgeAtQuote(quote))")
    public abstract QuoteResponse toResponse(Quote quote);

    protected Character resolveCharacter(Long characterId) {
        if (characterId == null) {
            return null;
        }
        if (characterId <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "characterId must be positive");
        }
        return characterRepository.findById(characterId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.BAD_REQUEST, "Unknown characterId: " + characterId));
    }

    protected Integer computeAuthorAgeAtQuote(Quote quote) {
        if (quote == null || quote.getAuthor() == null || quote.getAuthor().getDateOfBirth() == null) {
            return null;
        }

        LocalDate quoteDate = quote.getDate();
        if (quoteDate == null) {
            return null;
        }

        LocalDate authorBirth = quote.getAuthor().getDateOfBirth();
        int age = quoteDate.getYear() - authorBirth.getYear();

        if (quoteDate.getMonthValue() < authorBirth.getMonthValue() ||
                (quoteDate.getMonthValue() == authorBirth.getMonthValue() &&
                        quoteDate.getDayOfMonth() < authorBirth.getDayOfMonth())) {
            age--;
        }

        return age;
    }
}
