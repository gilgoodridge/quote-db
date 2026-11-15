CREATE TABLE candidate_authors (
    id BIGINT NOT NULL AUTO_INCREMENT,
    import_key VARCHAR(128) NOT NULL,
    source VARCHAR(64) NOT NULL,
    source_page_id BIGINT NOT NULL,
    source_revision_id BIGINT NOT NULL,
    dump_date DATE NOT NULL,
    source_title VARCHAR(255) NOT NULL,
    source_url VARCHAR(2048) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    full_name VARCHAR(255) NOT NULL,
    published_author_id BIGINT,
    PRIMARY KEY (id),
    CONSTRAINT uk_candidate_author_import_key UNIQUE (import_key),
    CONSTRAINT fk_candidate_published_author FOREIGN KEY (published_author_id) REFERENCES authors (id),
    CONSTRAINT ck_candidate_author_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
) ENGINE=InnoDB;

CREATE INDEX idx_candidate_author_status ON candidate_authors (status, id);

CREATE TABLE candidate_quotes (
    id BIGINT NOT NULL AUTO_INCREMENT,
    import_key VARCHAR(128) NOT NULL,
    source VARCHAR(64) NOT NULL,
    source_page_id BIGINT NOT NULL,
    source_revision_id BIGINT NOT NULL,
    dump_date DATE NOT NULL,
    source_title VARCHAR(255) NOT NULL,
    source_url VARCHAR(2048) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    text VARCHAR(2048) NOT NULL,
    raw_wikitext TEXT NOT NULL,
    source_notes TEXT,
    candidate_author_id BIGINT NOT NULL,
    published_quote_id BIGINT,
    PRIMARY KEY (id),
    CONSTRAINT uk_candidate_quote_import_key UNIQUE (import_key),
    CONSTRAINT fk_candidate_quote_author FOREIGN KEY (candidate_author_id) REFERENCES candidate_authors (id),
    CONSTRAINT fk_candidate_published_quote FOREIGN KEY (published_quote_id) REFERENCES quotes (id),
    CONSTRAINT ck_candidate_quote_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
) ENGINE=InnoDB;

CREATE INDEX idx_candidate_quote_author_status ON candidate_quotes (candidate_author_id, status, id);
CREATE INDEX idx_candidate_quote_status ON candidate_quotes (status, id);
