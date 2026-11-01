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

    /** Use QuoteSearchText.normalizeQuery to stem query words while retaining phrase boundaries. */
    @Query(value = """
            SELECT q.*
            FROM quotes q
            WHERE MATCH(q.search_text) AGAINST (:query IN NATURAL LANGUAGE MODE) > 0
              AND (:authorId IS NULL OR q.author_id = :authorId)
            ORDER BY MATCH(q.search_text) AGAINST (:query IN NATURAL LANGUAGE MODE) DESC, q.id ASC
            """, nativeQuery = true)
    List<Quote> search(@Param("query") String query, @Param("authorId") Long authorId);
}
