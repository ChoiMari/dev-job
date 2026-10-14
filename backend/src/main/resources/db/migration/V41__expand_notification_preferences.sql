ALTER TABLE notification_preference DROP CONSTRAINT notification_preference_type_check;
ALTER TABLE notification_preference ADD CONSTRAINT notification_preference_type_check
    CHECK (type IN ('INTERVIEW_REMINDER', 'TODO_REMINDER', 'NEW_JOB',
        'AI_JOB_RECOMMENDATION', 'SAVED_JOB_UPDATE', 'DOCUMENT_ANALYSIS',
        'MATCH_ANALYSIS', 'SEMANTIC_RECOMMENDATION', 'LEARNING_GOAL_REMINDER',
        'CHARACTER_ACTIVITY', 'SERVICE_NOTICE'));
