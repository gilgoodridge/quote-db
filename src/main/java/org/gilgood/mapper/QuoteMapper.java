package org.gilgood.mapper;

import org.gilgood.dto.CreateQuoteRequest;
import org.gilgood.dto.QuoteResponse;
import org.gilgood.dto.UpdateQuoteRequest;
import org.gilgood.entity.Quote;
import org.gilgood.repository.AuthorRepository;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.LocalDate;

@Mapper(componentModel = "spring")
public abstract class QuoteMapper {

    @Autowired
    protected AuthorRepository authorRepository;

    @Autowired
    protected AuthorMapper authorMapper;

    @Mapping(target = "author", expression = "java(authorRepository.getReferenceById(request.getAuthorId()))")
    @Mapping(target = "id", ignore = true)
    public abstract Quote toEntity(CreateQuoteRequest request);

    @Mapping(target = "author", expression = "java(authorRepository.getReferenceById(request.getAuthorId()))")
    @Mapping(target = "id", ignore = true)
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
