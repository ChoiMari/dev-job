ALTER TABLE notification DROP CONSTRAINT notification_type_check;
ALTER TABLE notification ADD CONSTRAINT notification_type_check CHECK (type IN (
    'INTERVIEW_REMINDER', 'TODO_REMINDER', 'NEW_JOB', 'AI_JOB_RECOMMENDATION',
    'SAVED_JOB_UPDATE', 'DOCUMENT_ANALYSIS', 'MATCH_ANALYSIS', 'PERSONAL_JOB_ANALYSIS',
    'SEMANTIC_RECOMMENDATION', 'LEARNING_GOAL_REMINDER', 'CHARACTER_ACTIVITY',
    'SERVICE_NOTICE'));

ALTER TABLE notification_outbox DROP CONSTRAINT notification_outbox_type_check;
ALTER TABLE notification_outbox ADD CONSTRAINT notification_outbox_type_check CHECK (type IN (
    'NEW_JOB', 'AI_JOB_RECOMMENDATION', 'SAVED_JOB_UPDATE',
    'DOCUMENT_ANALYSIS', 'MATCH_ANALYSIS', 'PERSONAL_JOB_ANALYSIS',
    'SEMANTIC_RECOMMENDATION', 'CHARACTER_ACTIVITY', 'SERVICE_NOTICE'));

-- Complete analyses made since notification rollout are retried through the same outbox path.
INSERT INTO notification_outbox(type, source_id, occurred_at)
SELECT 'PERSONAL_JOB_ANALYSIS', a.personal_saved_job_id, a.analyzed_at
FROM personal_saved_job_analysis a
JOIN personal_saved_job j ON j.id=a.personal_saved_job_id
CROSS JOIN notification_delivery_start rollout
WHERE a.status='COMPLETED' AND a.analyzed_at IS NOT NULL
  AND a.analyzed_at >= rollout.started_at AND j.deleted_at IS NULL
ON CONFLICT (type, source_id, occurred_at) DO NOTHING;
