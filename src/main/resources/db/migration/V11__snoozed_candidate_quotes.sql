ALTER TABLE candidate_quotes DROP CONSTRAINT ck_candidate_quote_status;

ALTER TABLE candidate_quotes
    ADD CONSTRAINT ck_candidate_quote_status
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'SNOOZED'));
