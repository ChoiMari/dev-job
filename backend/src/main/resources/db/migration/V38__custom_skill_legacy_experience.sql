-- Preserve legacy owned-skill experience when its owner explicitly converts it.
ALTER TABLE user_custom_skill ADD COLUMN experience_months INTEGER
    CHECK (experience_months BETWEEN 0 AND 600);
