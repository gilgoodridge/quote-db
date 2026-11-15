package org.gilgood.repository;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;

import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class CandidateMigrationTest {
    @Test
    void preservesPublishedDataAndEnforcesCandidateKeysStatesAndLinks() throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=MySQL");
             var statement = connection.createStatement()) {
            ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/migration/V1__initial_schema.sql"));
            statement.execute("INSERT INTO authors (id, full_name, date_of_birth) VALUES (1, 'Author', '1900-01-01')");
            statement.execute("INSERT INTO quotes (id, text, author_id) VALUES (42, 'Existing quote', 1)");
            ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/migration/V9__candidate_staging.sql"));
            ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/migration/V11__snoozed_candidate_quotes.sql"));
            String authorInsert = """
                    INSERT INTO candidate_authors (import_key, source, source_page_id, source_revision_id,
                        dump_date, source_title, source_url, full_name)
                    VALUES ('enwikiquote:2', 'enwikiquote', 2, 100, '2026-10-01', 'Author',
                        'https://en.wikiquote.org/wiki/Author', 'Author')
                    """;
            statement.execute(authorInsert);
            assertThrows(SQLException.class, () -> statement.execute(authorInsert));
            statement.execute("""
                    INSERT INTO candidate_quotes (import_key, source, source_page_id, source_revision_id,
                        dump_date, source_title, source_url, text, raw_wikitext, candidate_author_id)
                    VALUES ('enwikiquote:2:abc', 'enwikiquote', 2, 100, '2026-10-01', 'Author',
                        'https://en.wikiquote.org/wiki/Author', 'Quote', '* Quote', 1)
                    """);
            try (var rows = statement.executeQuery("SELECT status FROM candidate_quotes")) {
                assertTrue(rows.next());
                assertEquals("PENDING", rows.getString(1));
            }
            assertThrows(SQLException.class, () -> statement.execute(
                    "UPDATE candidate_quotes SET candidate_author_id = 999"));
            assertThrows(SQLException.class, () -> statement.execute(
                    "UPDATE candidate_quotes SET status = 'UNKNOWN'"));
            assertThrows(SQLException.class, () -> statement.execute(
                    "UPDATE candidate_authors SET status = 'UNKNOWN'"));
            statement.execute("UPDATE candidate_quotes SET status = 'SNOOZED'");
            assertThrows(SQLException.class, () -> statement.execute(
                    "UPDATE candidate_authors SET status = 'SNOOZED'"));
            assertThrows(SQLException.class, () -> statement.execute(
                    "DELETE FROM candidate_authors WHERE id = 1"));
            statement.execute("UPDATE candidate_authors SET published_author_id = 1");
            statement.execute("UPDATE candidate_quotes SET published_quote_id = 42");
            assertThrows(SQLException.class, () -> statement.execute("DELETE FROM quotes WHERE id = 42"));
            assertThrows(SQLException.class, () -> statement.execute(
                    "UPDATE candidate_quotes SET published_quote_id = 999"));
            assertThrows(SQLException.class, () -> statement.execute(
                    "UPDATE candidate_authors SET published_author_id = 999"));
            try (var rows = statement.executeQuery("SELECT text FROM quotes WHERE id = 42")) {
                assertTrue(rows.next());
                assertEquals("Existing quote", rows.getString(1));
            }
            try (var rows = statement.executeQuery("SELECT status FROM candidate_quotes")) {
                assertTrue(rows.next());
                assertEquals("SNOOZED", rows.getString(1));
            }
            statement.execute("DELETE FROM candidate_quotes");
            statement.execute("DELETE FROM candidate_authors");
            try (var rows = statement.executeQuery("SELECT COUNT(*) FROM authors")) {
                assertTrue(rows.next());
                assertEquals(1, rows.getInt(1));
            }
        }
    }
}
