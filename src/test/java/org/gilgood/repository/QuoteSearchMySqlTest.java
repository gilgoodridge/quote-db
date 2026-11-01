package org.gilgood.repository;

import org.flywaydb.core.Flyway;
import org.gilgood.entity.Author;
import org.gilgood.entity.Quote;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
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
        assertEquals(List.of(added.getId()), ids(quotes.search("telescope", null)));
        added.setText("microscope");
        quotes.saveAndFlush(added);
        assertTrue(quotes.search("telescope", null).isEmpty());
        assertEquals(List.of(added.getId()), ids(quotes.search("microscope", null)));
        quotes.deleteById(added.getId());
        assertTrue(quotes.search("microscope", null).isEmpty());
    }

    @Test
    void existingSchemaCanBeBaselinedWithoutLosingDataAndMigrationIsRepeatable() throws SQLException {
        createDatabase(LEGACY_DATABASE);
        Flyway.configure().dataSource(serverUrl() + LEGACY_DATABASE, username(), password())
                .target("1").load().migrate();
        try (Connection connection = DriverManager.getConnection(serverUrl() + LEGACY_DATABASE, username(), password());
             var statement = connection.createStatement()) {
            statement.executeUpdate("INSERT INTO authors (full_name, date_of_birth) VALUES ('Legacy Author', '1900-01-01')");
            statement.executeUpdate("INSERT INTO quotes (text, author_id) VALUES ('legacy orchard', 1)");
            statement.executeUpdate("DROP TABLE flyway_schema_history");
        }
        Flyway flyway = Flyway.configure().dataSource(serverUrl() + LEGACY_DATABASE, username(), password())
                .baselineOnMigrate(true).load();
        assertEquals(1, flyway.migrate().migrationsExecuted);
        assertEquals(0, flyway.migrate().migrationsExecuted);
        try (Connection connection = DriverManager.getConnection(serverUrl() + LEGACY_DATABASE, username(), password());
             var statement = connection.createStatement();
             var results = statement.executeQuery(
                     "SELECT text FROM quotes WHERE MATCH(text) AGAINST ('orchard' IN NATURAL LANGUAGE MODE) > 0")) {
            assertTrue(results.next());
            assertEquals("legacy orchard", results.getString(1));
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
