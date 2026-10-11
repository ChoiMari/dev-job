ALTER TABLE interview_schedule
    ADD COLUMN completed_at TIMESTAMPTZ;

ALTER TABLE interview_schedule
    ADD CONSTRAINT interview_schedule_one_final_state
    CHECK (cancelled_at IS NULL OR completed_at IS NULL);
