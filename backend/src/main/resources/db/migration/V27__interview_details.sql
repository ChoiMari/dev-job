ALTER TABLE interview_schedule
    ADD COLUMN stage VARCHAR(12) CHECK (stage IN ('FIRST', 'SECOND', 'FINAL', 'OTHER')),
    ADD COLUMN interview_method VARCHAR(12) CHECK (interview_method IN ('IN_PERSON', 'ONLINE', 'PHONE')),
    ADD COLUMN memo VARCHAR(500);
