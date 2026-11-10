package org.gilgood.repository;

import org.flywaydb.core.Flyway;
import org.gilgood.entity.Author;
import org.gilgood.entity.Quote;
import org.gilgood.entity.Tone;
import org.gilgood.search.QuoteSearchText;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@EnabledIfEnvironmentVariable(named = "MYSQL_TEST_URL", matches = ".+")
@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=validate")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class QuoteSearchMySqlTest {
    private static final String DATABASE = "quote_db_search_test_" + UUID.randomUUID().toString().replace("-", "");
    private static final String LEGACY_DATABASE = DATABASE + "_legacy";

    @Autowired
    private QuoteRepository quotes;
    @Autowired
    private AuthorRepository authors;
    @Autowired
    private ToneRepository tones;
    private Author firstAuthor;
    private Quote bestMatch;
    private Quote weakerMatch;
    private Quote otherWord;

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) throws SQLException {
        createDatabase(DATABASE);
        registry.add("spring.datasource.url", () -> serverUrl() + DATABASE);
        registry.add("spring.datasource.username", QuoteSearchMySqlTest::username);
        registry.add("spring.datasource.password", QuoteSearchMySqlTest::password);
        registry.add("spring.jpa.properties.hibernate.dialect", () -> "org.hibernate.dialect.MySQLDialect");
    }

    @BeforeEach
    void setUp() {
        quotes.deleteAll();
        authors.deleteAll();
        firstAuthor = author("First Author");
        Author secondAuthor = author("Second Author");
        bestMatch = quotes.saveAndFlush(new Quote("orchard orchard orchard", firstAuthor));
        weakerMatch = quotes.saveAndFlush(new Quote("orchard", secondAuthor));
        otherWord = quotes.saveAndFlush(new Quote("lantern", firstAuthor));
        Quote metadataOnly = new Quote("A completely unrelated quotation", firstAuthor);
        metadataOnly.setLocation("orchard");
        metadataOnly.setReference("orchard");
        quotes.saveAndFlush(metadataOnly);
    }

    @Test
    void matchesAnyWordRanksByRelevanceAndCombinesAuthorFilter() {
        assertEquals(List.of(bestMatch.getId(), weakerMatch.getId()), ids(quotes.search("orchard", null)));
        assertEquals(List.of(bestMatch.getId()), ids(quotes.search("orchard", firstAuthor.getId())));
        assertEquals(3, quotes.search("orchard lantern", null).size());
        assertTrue(quotes.search("orchard", Long.MAX_VALUE).isEmpty());
        assertEquals(4, quotes.findAll().size());
        assertEquals(3, quotes.findByAuthorId(firstAuthor.getId()).size());
    }

    @Test
    void combinesCategoryFiltersWithTextAndAuthorFilters() {
        Tone tone = new Tone();
        tone.setName("Test tone");
        tone.setDescription("A tone used to test quote search filtering.");
        tone = tones.saveAndFlush(tone);
        bestMatch.getTones().add(tone);
        quotes.saveAndFlush(bestMatch);

        assertEquals(List.of(bestMatch.getId()), ids(quotes.search(
                "orchard", firstAuthor.getId(),
                true, List.of(tone.getId()),
                false, List.of(0L),
                false, List.of(0L),
                false, List.of(0L))));
        assertTrue(quotes.search(
                "orchard", firstAuthor.getId(),
                true, List.of(Long.MAX_VALUE),
                false, List.of(0L),
                false, List.of(0L),
                false, List.of(0L)).isEmpty());
    }

    @Test
    void paginatesNativeSearchWithFilteredCountsAndRelevanceOrdering() {
        var first = searchPage("orchard", null, false, List.of(0L), 0);
        var second = searchPage("orchard", null, false, List.of(0L), 1);
        assertEquals(List.of(bestMatch.getId()), ids(first.getContent()));
        assertEquals(List.of(weakerMatch.getId()), ids(second.getContent()));
        assertEquals(2, first.getTotalElements());
        assertEquals(2, first.getTotalPages());
        assertEquals(2, second.getTotalElements());
        var beyond = searchPage("orchard", null, false, List.of(0L), 2);
        assertTrue(beyond.isEmpty());
        assertEquals(2, beyond.getTotalElements());
        assertEquals(1, searchPage("orchard", firstAuthor.getId(), false, List.of(0L), 0).getTotalElements());
        assertEquals(0, searchPage("unfindable", null, false, List.of(0L), 0).getTotalElements());

        Tone tone = new Tone();
        tone.setName("Pagination tone");
        tone.setDescription("Pagination search test.");
        tone = tones.saveAndFlush(tone);
        bestMatch.getTones().add(tone);
        quotes.saveAndFlush(bestMatch);
        var filtered = searchPage("orchard", firstAuthor.getId(), true, List.of(tone.getId()), 0);
        assertEquals(List.of(bestMatch.getId()), ids(filtered.getContent()));
        assertEquals(1, filtered.getTotalElements());
        assertEquals(0, searchPage("orchard", firstAuthor.getId(), true, List.of(Long.MAX_VALUE), 0)
                .getTotalElements());
        var filteredBeyond = searchPage("orchard", firstAuthor.getId(), true, List.of(tone.getId()), 1);
        assertTrue(filteredBeyond.isEmpty());
        assertEquals(1, filteredBeyond.getTotalElements());
    }

    private Page<Quote> searchPage(String query, Long authorId, boolean filterTones, List<Long> toneIds, int page) {
        return quotes.search(query, authorId, filterTones, toneIds,
                false, List.of(0L), false, List.of(0L), false, List.of(0L), PageRequest.of(page, 1));
    }

    @Test
    void stopwordsShortWordsSubstringsAndInjectionDoNotMatchEverything() {
        for (String query : List.of("the", "xy", "orcha", "unfindable", "' OR 1=1 --")) {
            assertTrue(quotes.search(query, null).isEmpty(), query);
        }
        assertEquals(ids(quotes.search("orchard", null)), ids(quotes.search("ORCHARD", null)));
        assertEquals(3, quotes.search("orchard OR lantern", null).size());
    }

    @Test
    void breaksRelevanceTiesById() {
        Quote tie = quotes.saveAndFlush(new Quote("lantern", firstAuthor));
        assertEquals(List.of(otherWord.getId(), tie.getId()), ids(quotes.search("lantern", null)));
    }

    @Test
    void indexTracksCommittedCreatesUpdatesAndDeletes() {
        Quote added = quotes.saveAndFlush(new Quote("telescope", firstAuthor));
        assertEquals(List.of(added.getId()), ids(quotes.search(QuoteSearchText.normalizeQuery("telescope"), null)));
        added.setText("microscope");
        quotes.saveAndFlush(added);
        assertTrue(quotes.search(QuoteSearchText.normalizeQuery("telescope"), null).isEmpty());
        assertEquals(List.of(added.getId()), ids(quotes.search(QuoteSearchText.normalizeQuery("microscope"), null)));
        quotes.deleteById(added.getId());
        assertTrue(quotes.search(QuoteSearchText.normalizeQuery("microscope"), null).isEmpty());
    }

    @Test
    void stemsQuoteWritesAndQueriesWithoutChangingOriginalText() {
        Quote added = quotes.saveAndFlush(new Quote("We hoped for peace.", firstAuthor));
        assertEquals("We hoped for peace.", added.getText());
        assertEquals("we hope for peac", added.getSearchText());
        for (String query : List.of("hope", "hopes", "hoped", "hoping", "HOPING")) {
            assertEquals(List.of(added.getId()), ids(quotes.search(QuoteSearchText.normalize(query), null)));
            assertEquals(List.of(added.getId()),
                    ids(quotes.search(QuoteSearchText.normalize(query), firstAuthor.getId())));
        }
        added.setText("We walked together.");
        quotes.saveAndFlush(added);
        assertTrue(quotes.search("hope", null).isEmpty());
        assertEquals(List.of(added.getId()), ids(quotes.search(QuoteSearchText.normalize("walks"), null)));
        assertEquals("We walked together.", quotes.findById(added.getId()).orElseThrow().getText());
        quotes.deleteById(added.getId());
        assertTrue(quotes.search("walk", null).isEmpty());
        assertTrue(quotes.search(QuoteSearchText.normalize("...!!!"), null).isEmpty());
    }

    @Test
    void quotedShakespearePhraseExcludesQuotesThatOnlyShareNot() {
        Quote shakespeare = quotes.saveAndFlush(new Quote("To be, or not to be, that is the question.", firstAuthor));
        Quote churchill = quotes.saveAndFlush(new Quote(
                "Success is not final, failure is not fatal: it is the courage to continue that counts.", firstAuthor));
        String phrase = "to be or not to be";
        assertEquals(List.of(shakespeare.getId()),
                ids(quotes.search(QuoteSearchText.normalizeQuery("\"" + phrase + "\""), null)));
        List<Long> unquoted = ids(quotes.search(QuoteSearchText.normalizeQuery(phrase), null));
        assertTrue(unquoted.contains(shakespeare.getId()));
        assertTrue(unquoted.contains(churchill.getId()));
        assertEquals(List.of(shakespeare.getId()),
                ids(quotes.search(QuoteSearchText.normalizeQuery("\"" + phrase + "\""), firstAuthor.getId())));
    }

    @Test
    void quotedStemmedPhraseRequiresWordOrderAndIgnoresPunctuation() {
        Quote match = quotes.saveAndFlush(new Quote("We hoped, for peace.", firstAuthor));
        quotes.saveAndFlush(new Quote("Peace for those who hoped.", firstAuthor));
        quotes.saveAndFlush(new Quote("We hoped deeply for peace.", firstAuthor));
        String query = QuoteSearchText.normalizeQuery("\"HOPING for peace\"");
        assertEquals(List.of(match.getId()), ids(quotes.search(query, null)));
        assertEquals(3, quotes.search(QuoteSearchText.normalizeQuery("HOPING for peace"), null).size());
        assertTrue(quotes.search(QuoteSearchText.normalizeQuery("\"...\""), null).isEmpty());
        assertTrue(quotes.search(QuoteSearchText.normalizeQuery("\"to be\""), null).isEmpty());
    }

    @ParameterizedTest
    @CsvSource({
            "moving, move moves moved moving",
            "running, run runs running",
            "connections, connect connected connecting connection",
            "studied, study studies studying",
            "relational, relate relations",
            "skies, sky skies",
            "dying, die dying"
    })
    void searchesComplexStemFamiliesWithAuthorFiltering(String text, String queries) {
        Quote match = quotes.saveAndFlush(new Quote(text, firstAuthor));
        for (String query : queries.split(" ")) {
            assertEquals(List.of(match.getId()), ids(quotes.search(QuoteSearchText.normalizeQuery(query), null)), query);
            assertEquals(List.of(match.getId()),
                    ids(quotes.search(QuoteSearchText.normalizeQuery(query), firstAuthor.getId())), query);
            assertTrue(quotes.search(QuoteSearchText.normalizeQuery(query), weakerMatch.getAuthor().getId()).isEmpty());
        }
    }

    @Test
    void existingSchemaCanBeBaselinedWithoutLosingDataAndMigrationIsRepeatable() throws SQLException {
        createDatabase(LEGACY_DATABASE);
        Flyway.configure().dataSource(serverUrl() + LEGACY_DATABASE, username(), password())
                .target("1").load().migrate();
        try (Connection connection = DriverManager.getConnection(serverUrl() + LEGACY_DATABASE, username(), password());
             var statement = connection.createStatement()) {
            statement.executeUpdate("INSERT INTO authors (full_name, date_of_birth) VALUES ('Legacy Author', '1900-01-01')");
            statement.executeUpdate("""
                    INSERT INTO quotes (text, author_id, date, location, reference)
                    VALUES ('We hoped for peace while moving.', 1, '1950-01-02', 'Old location', 'Old reference')
                    """);
            statement.executeUpdate("DROP TABLE flyway_schema_history");
        }
        Flyway flyway = Flyway.configure().dataSource(serverUrl() + LEGACY_DATABASE, username(), password())
                .baselineOnMigrate(true).target("2").load();
        assertEquals(1, flyway.migrate().migrationsExecuted);
        try (Connection connection = DriverManager.getConnection(serverUrl() + LEGACY_DATABASE, username(), password());
             var insert = connection.prepareStatement("INSERT INTO quotes (id, text, author_id) VALUES (?, ?, 1)")) {
            for (int index = 0; index < 1001; index++) {
                insert.setLong(1, 10L + index * 3L);
                insert.setString(2, "We hoped for peace while moving.");
                insert.addBatch();
            }
            insert.executeBatch();
        }
        flyway = Flyway.configure().dataSource(serverUrl() + LEGACY_DATABASE, username(), password()).load();
        assertEquals(6, flyway.migrate().migrationsExecuted);
        assertEquals(0, flyway.migrate().migrationsExecuted);
        try (Connection connection = DriverManager.getConnection(serverUrl() + LEGACY_DATABASE, username(), password());
             var statement = connection.createStatement()) {
            try (var results = statement.executeQuery("""
                    SELECT COUNT(*) FROM quotes
                    WHERE search_text = 'we hope for peac while move'
                      AND MATCH(search_text) AGAINST ('move' IN NATURAL LANGUAGE MODE) > 0
                    """)) {
                assertTrue(results.next());
                assertEquals(1002, results.getInt(1));
            }
            try (var results = statement.executeQuery("SELECT * FROM quotes WHERE id = 1")) {
                assertTrue(results.next());
                assertEquals("We hoped for peace while moving.", results.getString("text"));
                assertEquals(1, results.getLong("author_id"));
                assertEquals("1950-01-02", results.getString("date"));
                assertEquals("Old location", results.getString("location"));
                assertEquals("Old reference", results.getString("reference"));
                assertNull(results.getObject("character_id"));
            }
            statement.executeUpdate("""
                    INSERT INTO characters (full_name, known_as, description, work_title)
                    VALUES ('Hamlet', 'Prince Hamlet', 'Prince of Denmark', 'Hamlet')
                    """);
            statement.executeUpdate("UPDATE quotes SET character_id = 1 WHERE id = 1");
            assertThrows(SQLException.class,
                    () -> statement.executeUpdate("DELETE FROM characters WHERE id = 1"));
            statement.executeUpdate("UPDATE quotes SET character_id = NULL WHERE id = 1");
            statement.executeUpdate("DELETE FROM characters WHERE id = 1");
            for (String table : List.of("quote_tones", "quote_themes", "quote_forms", "quote_sources")) {
                try (var results = statement.executeQuery("SELECT COUNT(*) FROM " + table)) {
                    assertTrue(results.next());
                    assertEquals(0, results.getInt(1));
                }
            }
            for (String table : List.of("tones", "themes", "forms", "sources")) {
                try (var results = statement.executeQuery(
                        "SELECT COUNT(*) FROM " + table + " WHERE description IS NOT NULL AND LENGTH(description) > 0")) {
                    assertTrue(results.next());
                    assertEquals(switch (table) {
                        case "tones" -> 7;
                        case "themes" -> 12;
                        case "forms" -> 6;
                        default -> 11;
                    }, results.getInt(1));
                }
            }
            try (var results = statement.executeQuery("""
                    SELECT DISTINCT INDEX_NAME FROM information_schema.statistics
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'quotes' AND INDEX_TYPE = 'FULLTEXT'
                    """)) {
                assertTrue(results.next());
                assertEquals("ft_quotes_search_text", results.getString(1));
                assertFalse(results.next());
            }
        }
    }

    @AfterAll
    static void dropTestDatabases() throws SQLException {
        try (Connection connection = DriverManager.getConnection(serverUrl(), username(), password());
             var statement = connection.createStatement()) {
            statement.executeUpdate("DROP DATABASE IF EXISTS `" + LEGACY_DATABASE + "`");
            statement.executeUpdate("DROP DATABASE IF EXISTS `" + DATABASE + "`");
        }
    }

    private static void createDatabase(String name) throws SQLException {
        try (Connection connection = DriverManager.getConnection(serverUrl(), username(), password());
             var statement = connection.createStatement()) {
            statement.executeUpdate("CREATE DATABASE `" + name + "`");
        }
    }

    private static String serverUrl() {
        String url = System.getenv("MYSQL_TEST_URL");
        if (url == null || !url.matches("jdbc:mysql://[^/]+/")) {
            throw new IllegalArgumentException("MYSQL_TEST_URL must be a server-only URL, e.g. jdbc:mysql://localhost:3306/");
        }
        return url;
    }

    private static String username() {
        return System.getenv("MYSQL_TEST_USERNAME");
    }

    private static String password() {
        return System.getenv("MYSQL_TEST_PASSWORD");
    }

    private Author author(String name) {
        Author author = new Author(name);
        author.setDateOfBirth(LocalDate.of(1900, 1, 1));
        return authors.saveAndFlush(author);
    }

    private List<Long> ids(List<Quote> results) {
        return results.stream().map(Quote::getId).toList();
    }
}
