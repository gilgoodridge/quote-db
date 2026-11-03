package org.gilgood.repository;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;

import java.sql.DriverManager;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class CategoryMigrationTest {
    @Test
    void descriptionsUpgradePopulatesAllOptionsWithoutChangingIdsOrSelections() throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=MySQL");
             var statement = connection.createStatement()) {
            statement.execute("CREATE TABLE quotes (id BIGINT PRIMARY KEY, text VARCHAR(2048))");
            statement.execute("INSERT INTO quotes VALUES (42, 'Existing categorized quote')");
            ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/migration/V6__quote_categories.sql"));
            for (String table : List.of("quote_tones", "quote_themes", "quote_forms", "quote_sources")) {
                statement.execute("INSERT INTO " + table + " VALUES (42, 1), (42, 2)");
            }
            ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/migration/V7__category_descriptions.sql"));
            for (var entry : Map.of("tones", 7, "themes", 12, "forms", 6, "sources", 11).entrySet()) {
                try (var rows = statement.executeQuery("SELECT id, description FROM " + entry.getKey() + " ORDER BY id")) {
                    for (int id = 1; id <= entry.getValue(); id++) {
                        assertTrue(rows.next());
                        assertEquals(id, rows.getLong("id"));
                        assertNotNull(rows.getString("description"));
                        assertFalse(rows.getString("description").isBlank());
                        assertTrue(rows.getString("description").length() <= 255);
                    }
                    assertFalse(rows.next());
                }
                assertThrows(java.sql.SQLException.class, () -> statement.execute(
                        "UPDATE " + entry.getKey() + " SET description = NULL WHERE id = 1"));
            }
            for (String table : List.of("quote_tones", "quote_themes", "quote_forms", "quote_sources")) {
                try (var rows = statement.executeQuery("SELECT * FROM " + table + " ORDER BY 2")) {
                    for (int id = 1; id <= 2; id++) {
                        assertTrue(rows.next());
                        assertEquals(42, rows.getLong(1));
                        assertEquals(id, rows.getLong(2));
                    }
                    assertFalse(rows.next());
                }
            }
            try (var rows = statement.executeQuery("SELECT description FROM forms WHERE name = 'Metaphor'")) {
                assertTrue(rows.next());
                assertEquals("Expresses an idea through comparison or analogy, literal or figurative.", rows.getString(1));
            }
            try (var rows = statement.executeQuery("SELECT text FROM quotes WHERE id = 42")) {
                assertTrue(rows.next());
                assertEquals("Existing categorized quote", rows.getString(1));
            }
        }
    }

    @Test
    void migrationInstallsExactCatalogsPreservesQuotesAndEnforcesRelationships() throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=MySQL");
             var statement = connection.createStatement()) {
            statement.execute("CREATE TABLE quotes (id BIGINT PRIMARY KEY, text VARCHAR(2048))");
            statement.execute("INSERT INTO quotes VALUES (1, 'Existing quote')");
            ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/migration/V6__quote_categories.sql"));

            var expected = Map.of(
                    "tones", List.of("Inspirational", "Funny", "Insightful", "Comforting", "Cautionary", "Cynical", "Provocative"),
                    "themes", List.of("Life & death", "Love & connection", "Success & failure", "Work & ambition",
                            "Wisdom & learning", "Courage & resolve", "Joy & meaning", "Time & change", "Society & power",
                            "Art & beauty", "Faith & belief", "Human nature"),
                    "forms", List.of("Aphorism", "Paradox", "Metaphor", "Retort", "Advice", "Verse"),
                    "sources", List.of("Movie", "Speech", "Play", "Letter", "Book", "Article", "Poem", "Song",
                            "Interview", "Conversation", "Journal"));
            for (var entry : expected.entrySet()) {
                try (var rows = statement.executeQuery("SELECT id, name FROM " + entry.getKey() + " ORDER BY id")) {
                    for (int i = 0; i < entry.getValue().size(); i++) {
                        assertTrue(rows.next());
                        assertEquals(i + 1, rows.getLong("id"));
                        assertEquals(entry.getValue().get(i), rows.getString("name"));
                        assertTrue(rows.getString("name").length() <= 32);
                    }
                    assertFalse(rows.next());
                }
            }
            try (var rows = statement.executeQuery("SELECT text FROM quotes WHERE id = 1")) {
                assertTrue(rows.next());
                assertEquals("Existing quote", rows.getString(1));
            }
            for (String dimension : List.of("tone", "theme", "form", "source")) {
                String table = "quote_" + dimension + "s";
                try (var rows = statement.executeQuery("SELECT COUNT(*) FROM " + table)) {
                    assertTrue(rows.next());
                    assertEquals(0, rows.getInt(1));
                }
                statement.execute("INSERT INTO " + table + " VALUES (1, 1), (1, 2)");
                assertThrows(java.sql.SQLException.class, () -> statement.execute("INSERT INTO " + table + " VALUES (1, 1)"));
                assertThrows(java.sql.SQLException.class, () -> statement.execute("INSERT INTO " + table + " VALUES (1, 999)"));
                assertThrows(java.sql.SQLException.class, () -> statement.execute("INSERT INTO " + table + " VALUES (999, 1)"));
            }
            statement.execute("DELETE FROM quotes WHERE id = 1");
            for (String table : List.of("quote_tones", "quote_themes", "quote_forms", "quote_sources")) {
                try (var rows = statement.executeQuery("SELECT COUNT(*) FROM " + table)) {
                    assertTrue(rows.next());
                    assertEquals(0, rows.getInt(1));
                }
            }
            try (var rows = statement.executeQuery("SELECT COUNT(*) FROM sources")) {
                assertTrue(rows.next());
                assertEquals(11, rows.getInt(1));
            }
        }
    }
}
