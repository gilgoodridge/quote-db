package org.gilgood.search;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.params.provider.CsvSource;

import static org.junit.jupiter.api.Assertions.*;

class QuoteSearchTextTest {
    @ParameterizedTest
    @ValueSource(strings = {"hope", "hopes", "hoped", "hoping", "HOPING"})
    void normalizesPluralsAndVerbForms(String word) {
        assertEquals("hope", QuoteSearchText.normalize(word));
    }

    @Test
    void tokenizesPlainTextWithoutInterpretingConnectorsAndPreservesFrequency() {
        assertEquals("hope or hope and hope", QuoteSearchText.normalize("Hoping OR +hopes AND \"hoped\"!"));
    }

    @ParameterizedTest
    @CsvSource({
            "move moves moved moving, move move move move",
            "walk walks walked walking, walk walk walk walk",
            "run runs running, run run run",
            "connect connected connecting connections, connect connect connect connect",
            "study studies studied studying, studi studi studi studi",
            "relate relational relations, relat relat relat",
            "sky skies, sky sky",
            "dying lying tying, die lie tie"
    })
    void handlesComplexSuffixesAndEnglishExceptions(String input, String expected) {
        assertEquals(expected, QuoteSearchText.normalize(input));
    }

    @Test
    void doesNotPromiseIrregularPluralOrSynonymEquivalence() {
        assertEquals("children child", QuoteSearchText.normalize("children child"));
    }

    @Test
    void handlesBlankPunctuationUnicodeAndRejectsNull() {
        assertEquals("", QuoteSearchText.normalize(" \t\n...+!!!"));
        assertEquals("café naïv", QuoteSearchText.normalize("CAFÉ—Naïve"));
        assertThrows(NullPointerException.class, () -> QuoteSearchText.normalize(null));
    }

    @Test
    void preservesPhrasesWhileNormalizingTheirWords() {
        assertEquals("\"to be or not to be\"", QuoteSearchText.normalizeQuery("\"To be, or not to be\""));
        assertEquals("\"hope for peac\"", QuoteSearchText.normalizeQuery("\"Hoping for peace\""));
        assertEquals("hope\"for peac\"or\"walk togeth\"",
                QuoteSearchText.normalizeQuery("HOPES \"for peace\" OR \"walked together\""));
        assertEquals("hope for peac", QuoteSearchText.normalizeQuery("Hoping for peace"));
    }

    @Test
    void retainsEmptyAndUnmatchedQuoteBoundariesWithoutInventingSyntax() {
        assertEquals("\"\"", QuoteSearchText.normalizeQuery("\"...\""));
        assertEquals("\"hope", QuoteSearchText.normalizeQuery("\"hoping"));
        assertEquals("hope\"", QuoteSearchText.normalizeQuery("hoping\""));
        assertEquals("", QuoteSearchText.normalizeQuery("...!!!"));
        assertThrows(NullPointerException.class, () -> QuoteSearchText.normalizeQuery(null));
    }
}
