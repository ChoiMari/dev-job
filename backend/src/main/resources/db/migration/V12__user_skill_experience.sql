ALTER TABLE user_skill
    ADD COLUMN proficiency_level INTEGER,
    ADD COLUMN experience_months INTEGER,
    ADD CONSTRAINT ck_user_skill_proficiency_level CHECK (proficiency_level BETWEEN 1 AND 5),
    ADD CONSTRAINT ck_user_skill_experience_months CHECK (experience_months BETWEEN 0 AND 600);
