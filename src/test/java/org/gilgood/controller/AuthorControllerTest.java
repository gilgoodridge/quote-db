package org.gilgood.controller;

import com.fasterxml.jackson.databind.SerializationFeature;
import org.gilgood.entity.Author;
import org.gilgood.exception.GlobalExceptionHandler;
import org.gilgood.mapper.AuthorMapper;
import org.gilgood.repository.AuthorRepository;
import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mapstruct.factory.Mappers;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.http.converter.StringHttpMessageConverter;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.sql.SQLException;
import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class AuthorControllerTest {
    @Mock
    private AuthorRepository repository;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        AuthorController controller = new AuthorController();
        ReflectionTestUtils.setField(controller, "authorRepository", repository);
        ReflectionTestUtils.setField(controller, "authorMapper", Mappers.getMapper(AuthorMapper.class));
        mvc = MockMvcBuilders.standaloneSetup(controller)
                .setMessageConverters(new StringHttpMessageConverter(), new MappingJackson2HttpMessageConverter(
                        Jackson2ObjectMapperBuilder.json()
                                .featuresToDisable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS).build()))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
    }

    @ParameterizedTest
    @ValueSource(strings = {"POST", "PUT"})
    void birthDateIsRequiredOnCreateAndReplace(String method) throws Exception {
        for (String body : new String[]{
                "{\"fullName\":\"Jane Austen\"}",
                "{\"fullName\":\"Jane Austen\",\"dateOfBirth\":null}",
                "{\"fullName\":\"Jane Austen\",\"dateOfBirth\":\"\"}"}) {
            mvc.perform(request(org.springframework.http.HttpMethod.valueOf(method),
                            method.equals("POST") ? "/api/authors" : "/api/authors/1")
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest());
        }
        verifyNoInteractions(repository);
    }

    @Test
    void fullNameIsStillRequired() throws Exception {
        mvc.perform(post("/api/authors").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"  \",\"dateOfBirth\":\"1775-12-16\"}"))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(repository);
    }

    @ParameterizedTest
    @ValueSource(strings = {"uk_author_full_name_birth", "authors.uk_author_known_as_birth"})
    void duplicateCreateAndUpdateReturnClearConflict(String constraint) throws Exception {
        var failure = new DataIntegrityViolationException("duplicate",
                new ConstraintViolationException("duplicate", new SQLException("duplicate"), constraint));
        when(repository.saveAndFlush(any(Author.class))).thenThrow(failure);
        when(repository.findById(1L)).thenReturn(Optional.of(new Author("Jane Austen")));

        for (String method : new String[]{"POST", "PUT"}) {
            mvc.perform(request(org.springframework.http.HttpMethod.valueOf(method),
                            method.equals("POST") ? "/api/authors" : "/api/authors/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"fullName\":\"Jane Austen\",\"dateOfBirth\":\"1775-12-16\"}"))
                    .andExpect(status().isConflict())
                    .andExpect(content().string("The author already exists"));
        }
    }

    @Test
    void savesAndReplacesUsingDtosAndNormalizesBlankKnownAs() throws Exception {
        when(repository.saveAndFlush(any(Author.class))).thenAnswer(invocation -> {
            Author author = invocation.getArgument(0);
            assertNull(author.getKnownAs());
            assertEquals(LocalDate.of(1775, 12, 16), author.getDateOfBirth());
            author.setId(1L);
            return author;
        });
        Author existing = new Author("Old name");
        existing.setKnownAs("Old alias");
        existing.setBio("Old bio");
        when(repository.findById(1L)).thenReturn(Optional.of(existing));

        for (String method : new String[]{"POST", "PUT"}) {
            mvc.perform(request(org.springframework.http.HttpMethod.valueOf(method),
                            method.equals("POST") ? "/api/authors" : "/api/authors/1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"fullName":"Jane Austen","knownAs":"  ","dateOfBirth":"1775-12-16"}
                                    """))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id").value(1))
                    .andExpect(jsonPath("$.fullName").value("Jane Austen"))
                    .andExpect(jsonPath("$.dateOfBirth").value("1775-12-16"))
                    .andExpect(jsonPath("$.quotes").doesNotExist());
        }
        assertNull(existing.getBio());
    }

    @Test
    void unrelatedIntegrityFailuresAreNotReportedAsDuplicateAuthors() {
        var failure = new DataIntegrityViolationException("other constraint",
                new ConstraintViolationException("other", new SQLException("other"), "uk_other"));
        assertSame(failure, assertThrows(DataIntegrityViolationException.class,
                () -> new GlobalExceptionHandler().handleDataIntegrityViolation(failure)));
    }
}
