package org.gilgood.controller;

import io.swagger.v3.oas.annotations.Operation;
import org.gilgood.dto.CategoryCatalogResponse;
import org.gilgood.service.CategoryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/categories")
public class CategoryController {
    private final CategoryService categoryService;

    public CategoryController(CategoryService categoryService) {
        this.categoryService = categoryService;
    }

    @GetMapping
    @Operation(summary = "List defined tones, themes, forms and sources",
            description = "Read-only catalogs in ID order. Each dimension supports optional multiple selections on quotes.")
    public CategoryCatalogResponse catalog() {
        return categoryService.catalog();
    }
}
