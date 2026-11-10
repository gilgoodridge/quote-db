CREATE TABLE characters (
    id BIGINT NOT NULL AUTO_INCREMENT,
    full_name VARCHAR(255) NOT NULL,
    known_as VARCHAR(255),
    description VARCHAR(1024),
    work_title VARCHAR(255),
    PRIMARY KEY (id)
) ENGINE=InnoDB;

ALTER TABLE quotes ADD COLUMN character_id BIGINT;
CREATE INDEX idx_quotes_character_id ON quotes (character_id);
ALTER TABLE quotes ADD CONSTRAINT fk_quote_character
    FOREIGN KEY (character_id) REFERENCES characters (id);
