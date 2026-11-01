ALTER TABLE quotes
    MODIFY COLUMN search_text TEXT NOT NULL,
    DROP INDEX ft_quotes_text,
    ADD FULLTEXT INDEX ft_quotes_search_text (search_text);
