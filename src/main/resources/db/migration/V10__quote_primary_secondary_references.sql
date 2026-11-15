ALTER TABLE quotes RENAME COLUMN reference TO primary_reference;

ALTER TABLE quotes ADD COLUMN secondary_reference VARCHAR(255) NULL;
