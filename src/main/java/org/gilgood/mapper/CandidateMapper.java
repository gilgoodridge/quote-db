package org.gilgood.mapper;

import org.gilgood.dto.*;
import org.gilgood.entity.CandidateAuthor;
import org.gilgood.entity.CandidateQuote;
import org.mapstruct.*;

@Mapper(componentModel = "spring", unmappedTargetPolicy = ReportingPolicy.ERROR)
public interface CandidateMapper {
    ImportCandidateQuoteRequest toImportRequest(ImportCandidateBatchRequest.QuoteRequest request,
                                               Long candidateAuthorId);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "status", ignore = true)
    @Mapping(target = "publishedAuthor", ignore = true)
    CandidateAuthor toEntity(ImportCandidateAuthorRequest request);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "status", ignore = true)
    @Mapping(target = "candidateAuthor", ignore = true)
    @Mapping(target = "publishedQuote", ignore = true)
    CandidateQuote toEntity(ImportCandidateQuoteRequest request);

    @Mapping(target = "publishedAuthorId", source = "publishedAuthor.id")
    CandidateAuthorResponse toResponse(CandidateAuthor candidate);

    @Mapping(target = "candidateAuthorId", source = "candidateAuthor.id")
    @Mapping(target = "publishedQuoteId", source = "publishedQuote.id")
    CandidateQuoteResponse toResponse(CandidateQuote candidate);

    @BeanMapping(ignoreByDefault = true)
    @Mapping(target = "fullName", source = "fullName")
    @Mapping(target = "status", source = "status")
    void updateEntity(UpdateCandidateAuthorRequest request, @MappingTarget CandidateAuthor candidate);

    @BeanMapping(ignoreByDefault = true)
    @Mapping(target = "text", source = "text")
    @Mapping(target = "status", source = "status")
    void updateEntity(UpdateCandidateQuoteRequest request, @MappingTarget CandidateQuote candidate);
}
