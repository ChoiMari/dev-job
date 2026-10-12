ALTER TABLE personal_todo_category
    ADD COLUMN icon_key VARCHAR(20) NOT NULL DEFAULT 'other'
        CHECK (icon_key IN ('document', 'interview', 'study', 'growth', 'health', 'travel', 'other'));
