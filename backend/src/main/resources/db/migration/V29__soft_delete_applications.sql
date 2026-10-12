ALTER TABLE application ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE application DROP CONSTRAINT uk_application_user_job;
DROP INDEX uk_application_user_personal_job;
CREATE UNIQUE INDEX uk_application_active_user_job ON application(user_id, job_posting_id)
    WHERE deleted_at IS NULL AND job_posting_id IS NOT NULL;
CREATE UNIQUE INDEX uk_application_active_user_personal_job ON application(user_id, personal_saved_job_id)
    WHERE deleted_at IS NULL AND personal_saved_job_id IS NOT NULL;
CREATE INDEX ix_application_active_user_status ON application(user_id, current_status, created_at DESC, id DESC)
    WHERE deleted_at IS NULL;
