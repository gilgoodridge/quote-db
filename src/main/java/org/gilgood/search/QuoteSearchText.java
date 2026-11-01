package org.gilgood.search;

import org.apache.lucene.analysis.Analyzer;
import org.apache.lucene.analysis.LowerCaseFilter;
import org.apache.lucene.analysis.snowball.SnowballFilter;
import org.apache.lucene.analysis.standard.StandardTokenizer;
import org.apache.lucene.analysis.tokenattributes.CharTermAttribute;
import org.tartarus.snowball.ext.EnglishStemmer;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Objects;
import java.util.StringJoiner;

public final class QuoteSearchText {
    private QuoteSearchText() {
    }

    public static String normalizeQuery(String query) {
        Objects.requireNonNull(query, "Quote search query must not be null");
        StringJoiner normalized = new StringJoiner("\"");
        // Leave phrase boundaries (including unmatched quotes) for MySQL to interpret.
        for (String segment : query.split("\"", -1)) {
            normalized.add(normalize(segment));
        }
        return normalized.toString();
    }

    public static String normalize(String text) {
        Objects.requireNonNull(text, "Quote search text must not be null");
        try (Analyzer analyzer = new Analyzer() {
            @Override
            protected TokenStreamComponents createComponents(String fieldName) {
                StandardTokenizer tokenizer = new StandardTokenizer();
                return new TokenStreamComponents(tokenizer,
                        new SnowballFilter(new LowerCaseFilter(tokenizer), new EnglishStemmer()));
            }
        }; var tokens = analyzer.tokenStream("search_text", text)) {
            CharTermAttribute term = tokens.addAttribute(CharTermAttribute.class);
            StringJoiner normalized = new StringJoiner(" ");
            tokens.reset();
            while (tokens.incrementToken()) {
                normalized.add(term.toString());
            }
            tokens.end();
            return normalized.toString();
        } catch (IOException exception) {
            throw new UncheckedIOException("Unable to normalize quote search text", exception);
        }
    }
}
