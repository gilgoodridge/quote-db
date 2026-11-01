CREATE TABLE authors (
    id BIGINT NOT NULL AUTO_INCREMENT,
    full_name VARCHAR(255) NOT NULL,
    known_as VARCHAR(255),
    date_of_birth DATE NOT NULL,
    date_of_death DATE,
    place_of_birth VARCHAR(255),
    nationality VARCHAR(255),
    bio VARCHAR(1024),
    PRIMARY KEY (id),
    CONSTRAINT uk_author_full_name_birth UNIQUE (full_name, date_of_birth),
    CONSTRAINT uk_author_known_as_birth UNIQUE (known_as, date_of_birth)
) ENGINE=InnoDB;

CREATE TABLE quotes (
    id BIGINT NOT NULL AUTO_INCREMENT,
    text VARCHAR(2048) NOT NULL,
    date DATE,
    location VARCHAR(255),
    reference VARCHAR(255),
    author_id BIGINT NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_quote_author FOREIGN KEY (author_id) REFERENCES authors (id)
) ENGINE=InnoDB;
