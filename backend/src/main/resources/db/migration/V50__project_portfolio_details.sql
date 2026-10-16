ALTER TABLE project
    ADD COLUMN summary VARCHAR(200),
    ADD COLUMN category VARCHAR(100),
    ADD COLUMN team_size INTEGER CHECK (team_size IS NULL OR team_size BETWEEN 1 AND 99),
    ADD COLUMN problem_solving VARCHAR(1000),
    ADD COLUMN feature_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN achievement_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN demo_url VARCHAR(2000),
    ADD COLUMN github_url VARCHAR(2000),
    ADD COLUMN presentation_url VARCHAR(2000),
    ADD COLUMN contribution_percent INTEGER CHECK (contribution_percent IS NULL OR contribution_percent BETWEEN 0 AND 100),
    ADD COLUMN responsibilities VARCHAR(1000),
    ADD COLUMN troubleshooting VARCHAR(1000),
    ADD COLUMN metric_items JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE project SET feature_items = jsonb_build_array(key_features)
WHERE key_features IS NOT NULL AND length(btrim(key_features)) > 0;
UPDATE project SET achievement_items = jsonb_build_array(outcome)
WHERE outcome IS NOT NULL AND length(btrim(outcome)) > 0;

ALTER TABLE project_skill ADD COLUMN usage_note VARCHAR(1000);
