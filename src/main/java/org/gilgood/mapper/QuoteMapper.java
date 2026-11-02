package org.gilgood.mapper;

import org.gilgood.dto.CreateQuoteRequest;
import org.gilgood.dto.QuoteResponse;
import org.gilgood.dto.UpdateQuoteRequest;
import org.gilgood.entity.Quote;
import org.gilgood.repository.AuthorRepository;
import org.gilgood.service.CategoryService;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDate;

@Mapper(componentModel = "spring", uses = CategoryMapper.class)
public abstract class QuoteMapper {

    @Autowired
    protected AuthorRepository authorRepository;

    @Autowired
    protected AuthorMapper authorMapper;

    @Autowired
    protected CategoryService categoryService;

    @Mapping(target = "tones", expression = "java(categoryService.resolveTones(request.getToneIds()))")
    @Mapping(target = "themes", expression = "java(categoryService.resolveThemes(request.getThemeIds()))")
    @Mapping(target = "forms", expression = "java(categoryService.resolveForms(request.getFormIds()))")
    @Mapping(target = "sources", expression = "java(categoryService.resolveSources(request.getSourceIds()))")
    @Mapping(target = "author", expression = "java(authorRepository.getReferenceById(request.getAuthorId()))")
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "searchText", ignore = true)
    public abstract Quote toEntity(CreateQuoteRequest request);

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
