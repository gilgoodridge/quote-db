package org.gilgood.service;

import org.gilgood.dto.CategoryCatalogResponse;
import org.gilgood.entity.*;
import org.gilgood.mapper.CategoryMapper;
import org.gilgood.repository.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class CategoryService {
    private final ToneRepository tones;
    private final ThemeRepository themes;
    private final FormRepository forms;
    private final SourceRepository sources;
    private final CategoryMapper mapper;

    public CategoryService(ToneRepository tones, ThemeRepository themes,
                           FormRepository forms, SourceRepository sources, CategoryMapper mapper) {
        this.tones = tones;
        this.themes = themes;
        this.forms = forms;
        this.sources = sources;
        this.mapper = mapper;
    }

    public CategoryCatalogResponse catalog() {
        return new CategoryCatalogResponse(mapper.toResponses(tones.findAll()), mapper.toResponses(themes.findAll()),
                mapper.toResponses(forms.findAll()), mapper.toResponses(sources.findAll()));
    }

    public Set<Tone> resolveTones(Set<Long> ids) {
        return resolve(ids, tones, "toneIds");
    }

    public Set<Theme> resolveThemes(Set<Long> ids) {
        return resolve(ids, themes, "themeIds");
    }

    public Set<Form> resolveForms(Set<Long> ids) {
        return resolve(ids, forms, "formIds");
    }

    public Set<Source> resolveSources(Set<Long> ids) {
        return resolve(ids, sources, "sourceIds");
    }

    private <T extends QuoteCategory> Set<T> resolve(Set<Long> ids, JpaRepository<T, Long> repository, String field) {
        if (ids == null || ids.isEmpty()) {
            return new LinkedHashSet<>();
        }
        if (ids.stream().anyMatch(id -> id == null || id <= 0)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " must contain only positive IDs");
        }
        var categories = repository.findAllById(ids);
        Set<Long> missing = new LinkedHashSet<>(ids);
        categories.forEach(category -> missing.remove(category.getId()));
        if (!missing.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown " + field + ": " + missing);
        }
        return categories.stream().sorted(Comparator.comparing(QuoteCategory::getId))
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }
}
