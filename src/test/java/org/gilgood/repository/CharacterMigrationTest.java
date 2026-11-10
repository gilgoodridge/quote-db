package org.gilgood.repository;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;

import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class CharacterMigrationTest {
    @Test
    void addsOptionalCharacterPreservingQuotesAndRestrictingDeletion() throws Exception {
        try (var connection = DriverManager.getConnection("jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=MySQL");
             var statement = connection.createStatement()) {
            ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/migration/V1__initial_schema.sql"));
            statement.execute("INSERT INTO authors (id, full_name, date_of_birth) VALUES (1, 'Author', '1900-01-01')");
            statement.execute("INSERT INTO quotes (id, text, author_id) VALUES (42, 'Existing quote', 1)");
            ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/migration/V8__quote_characters.sql"));
            try (var rows = statement.executeQuery("SELECT * FROM quotes WHERE id = 42")) {
                assertTrue(rows.next());
                assertEquals("Existing quote", rows.getString("text"));
                assertEquals(1, rows.getLong("author_id"));
                assertNull(rows.getObject("character_id"));
            }
            statement.execute("""
                    INSERT INTO characters (full_name, known_as, description, work_title)
                    VALUES ('Hamlet', 'Prince Hamlet', 'Prince of Denmark', 'Hamlet')
                    """);
            statement.execute("UPDATE quotes SET character_id = 1 WHERE id = 42");
            assertThrows(SQLException.class, () -> statement.execute("DELETE FROM characters WHERE id = 1"));
            assertThrows(SQLException.class, () -> statement.execute("UPDATE quotes SET character_id = 999 WHERE id = 42"));
            assertThrows(SQLException.class, () -> statement.execute("UPDATE quotes SET author_id = NULL WHERE id = 42"));
            assertThrows(SQLException.class, () -> statement.execute("INSERT INTO characters (full_name) VALUES (NULL)"));
            statement.execute("DELETE FROM quotes WHERE id = 42");
            try (var rows = statement.executeQuery("SELECT * FROM characters WHERE id = 1")) {
                assertTrue(rows.next());
                assertEquals("Hamlet", rows.getString("work_title"));
                assertEquals("Prince of Denmark", rows.getString("description"));
            }
            statement.execute("INSERT INTO quotes (id, text, author_id, character_id) VALUES (43, 'Other quote', 1, 1)");
            statement.execute("UPDATE quotes SET character_id = NULL WHERE id = 43");
            statement.execute("DELETE FROM characters WHERE id = 1");
            try (var rows = statement.executeQuery("SELECT author_id, character_id FROM quotes WHERE id = 43")) {
                assertTrue(rows.next());
                assertEquals(1, rows.getLong("author_id"));
                assertNull(rows.getObject("character_id"));
            }
        }
    }
}
