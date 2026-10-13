-- Remove the legacy shared catalog entries after the approved 66 system skills exist.
-- Keep analysis result_json and all account-specific skills/candidates intact.
DO $$
BEGIN
  IF (SELECT count(*) FROM skill WHERE is_system) <> 66 THEN
    RAISE EXCEPTION 'Expected the approved 66 system skills before catalog cleanup';
  END IF;
  IF EXISTS (SELECT 1 FROM user_skill us JOIN skill s ON s.id=us.skill_id WHERE NOT s.is_system)
    OR EXISTS (SELECT 1 FROM project_skill ps JOIN skill s ON s.id=ps.skill_id WHERE NOT s.is_system)
    OR EXISTS (SELECT 1 FROM learning_goal lg JOIN skill s ON s.id=lg.skill_id WHERE NOT s.is_system) THEN
    RAISE EXCEPTION 'Legacy skills still have user, project, or learning-goal references';
  END IF;
END $$;

DELETE FROM job_skill WHERE skill_id IN (SELECT id FROM skill WHERE NOT is_system);
DELETE FROM skill_alias WHERE skill_id IN (SELECT id FROM skill WHERE NOT is_system);
DELETE FROM skill WHERE NOT is_system;

CREATE FUNCTION prevent_non_system_skill() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT NEW.is_system THEN
    RAISE EXCEPTION 'Only approved system skills may be stored in the shared skill catalog';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER skill_system_only
  BEFORE INSERT OR UPDATE ON skill
  FOR EACH ROW EXECUTE FUNCTION prevent_non_system_skill();
