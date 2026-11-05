package org.gilgood.repository;

import org.gilgood.entity.Quote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QuoteRepository extends JpaRepository<Quote, Long> {
    List<Quote> findByAuthorId(Long authorId);

    @Query("""
            SELECT DISTINCT q
            FROM Quote q
            WHERE (:authorId IS NULL OR q.author.id = :authorId)
              AND (:filterTones = false OR EXISTS (
                  SELECT tone.id
                  FROM Quote categorizedQuote JOIN categorizedQuote.tones tone
                  WHERE categorizedQuote = q AND tone.id IN :toneIds
              ))
              AND (:filterThemes = false OR EXISTS (
                  SELECT theme.id
                  FROM Quote categorizedQuote JOIN categorizedQuote.themes theme
                  WHERE categorizedQuote = q AND theme.id IN :themeIds
              ))
              AND (:filterForms = false OR EXISTS (
                  SELECT form.id
                  FROM Quote categorizedQuote JOIN categorizedQuote.forms form
                  WHERE categorizedQuote = q AND form.id IN :formIds
              ))
              AND (:filterSources = false OR EXISTS (
                  SELECT source.id
                  FROM Quote categorizedQuote JOIN categorizedQuote.sources source
                  WHERE categorizedQuote = q AND source.id IN :sourceIds
              ))
            ORDER BY q.id ASC
            """)
    List<Quote> filterByCategories(
            @Param("authorId") Long authorId,
            @Param("filterTones") boolean filterTones, @Param("toneIds") List<Long> toneIds,
            @Param("filterThemes") boolean filterThemes, @Param("themeIds") List<Long> themeIds,
            @Param("filterForms") boolean filterForms, @Param("formIds") List<Long> formIds,
            @Param("filterSources") boolean filterSources, @Param("sourceIds") List<Long> sourceIds);

    /** Use QuoteSearchText.normalizeQuery to stem query words while retaining phrase boundaries. */
    @Query(value = """
            SELECT q.*
            FROM quotes q
            WHERE MATCH(q.search_text) AGAINST (:query IN NATURAL LANGUAGE MODE) > 0
              AND (:authorId IS NULL OR q.author_id = :authorId)
              AND (:filterTones = false OR EXISTS (
                  SELECT 1 FROM quote_tones qt WHERE qt.quote_id = q.id AND qt.tone_id IN (:toneIds)
              ))
              AND (:filterThemes = false OR EXISTS (
                  SELECT 1 FROM quote_themes qth WHERE qth.quote_id = q.id AND qth.theme_id IN (:themeIds)
              ))
              AND (:filterForms = false OR EXISTS (
                  SELECT 1 FROM quote_forms qf WHERE qf.quote_id = q.id AND qf.form_id IN (:formIds)
              ))
              AND (:filterSources = false OR EXISTS (
                  SELECT 1 FROM quote_sources qs WHERE qs.quote_id = q.id AND qs.source_id IN (:sourceIds)
              ))
            ORDER BY MATCH(q.search_text) AGAINST (:query IN NATURAL LANGUAGE MODE) DESC, q.id ASC
            """, nativeQuery = true)
    List<Quote> search(
            @Param("query") String query,
            @Param("authorId") Long authorId,
            @Param("filterTones") boolean filterTones, @Param("toneIds") List<Long> toneIds,
            @Param("filterThemes") boolean filterThemes, @Param("themeIds") List<Long> themeIds,
            @Param("filterForms") boolean filterForms, @Param("formIds") List<Long> formIds,
            @Param("filterSources") boolean filterSources, @Param("sourceIds") List<Long> sourceIds);

    default List<Quote> search(String query, Long authorId) {
        return search(query, authorId, false, List.of(0L), false, List.of(0L),
                false, List.of(0L), false, List.of(0L));
    }
}
