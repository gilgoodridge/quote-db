CREATE TABLE tones (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(32) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_tone_name UNIQUE (name)
) ENGINE=InnoDB;

CREATE TABLE themes (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(32) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_theme_name UNIQUE (name)
) ENGINE=InnoDB;

CREATE TABLE forms (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(32) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_form_name UNIQUE (name)
) ENGINE=InnoDB;

CREATE TABLE sources (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(32) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_source_name UNIQUE (name)
) ENGINE=InnoDB;

INSERT INTO tones (name) VALUES
    ('Inspirational'), ('Funny'), ('Insightful'), ('Comforting'),
    ('Cautionary'), ('Cynical'), ('Provocative');

INSERT INTO themes (name) VALUES
    ('Life & death'), ('Love & connection'), ('Success & failure'),
    ('Work & ambition'), ('Wisdom & learning'), ('Courage & resolve'),
    ('Joy & meaning'), ('Time & change'), ('Society & power'),
    ('Art & beauty'), ('Faith & belief'), ('Human nature');

INSERT INTO forms (name) VALUES
    ('Aphorism'), ('Paradox'), ('Metaphor'), ('Retort'), ('Advice'), ('Verse');

INSERT INTO sources (name) VALUES
    ('Movie'), ('Speech'), ('Play'), ('Letter'), ('Book'), ('Article'),
    ('Poem'), ('Song'), ('Interview'), ('Conversation'), ('Journal');

CREATE TABLE quote_tones (
    quote_id BIGINT NOT NULL,
    tone_id BIGINT NOT NULL,
    PRIMARY KEY (quote_id, tone_id),
    CONSTRAINT fk_quote_tone_quote FOREIGN KEY (quote_id) REFERENCES quotes (id) ON DELETE CASCADE,
    CONSTRAINT fk_quote_tone_tone FOREIGN KEY (tone_id) REFERENCES tones (id)
) ENGINE=InnoDB;

CREATE TABLE quote_themes (
    quote_id BIGINT NOT NULL,
    theme_id BIGINT NOT NULL,
    PRIMARY KEY (quote_id, theme_id),
    CONSTRAINT fk_quote_theme_quote FOREIGN KEY (quote_id) REFERENCES quotes (id) ON DELETE CASCADE,
    CONSTRAINT fk_quote_theme_theme FOREIGN KEY (theme_id) REFERENCES themes (id)
) ENGINE=InnoDB;

CREATE TABLE quote_forms (
    quote_id BIGINT NOT NULL,
    form_id BIGINT NOT NULL,
    PRIMARY KEY (quote_id, form_id),
    CONSTRAINT fk_quote_form_quote FOREIGN KEY (quote_id) REFERENCES quotes (id) ON DELETE CASCADE,
    CONSTRAINT fk_quote_form_form FOREIGN KEY (form_id) REFERENCES forms (id)
) ENGINE=InnoDB;

CREATE TABLE quote_sources (
    quote_id BIGINT NOT NULL,
    source_id BIGINT NOT NULL,
    PRIMARY KEY (quote_id, source_id),
    CONSTRAINT fk_quote_source_quote FOREIGN KEY (quote_id) REFERENCES quotes (id) ON DELETE CASCADE,
    CONSTRAINT fk_quote_source_source FOREIGN KEY (source_id) REFERENCES sources (id)
) ENGINE=InnoDB;
