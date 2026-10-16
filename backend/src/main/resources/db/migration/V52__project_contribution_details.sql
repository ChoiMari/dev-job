ALTER TABLE project
    ADD COLUMN contribution_items JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN troubleshooting_items JSONB NOT NULL DEFAULT '[]';

UPDATE project
SET contribution_items = jsonb_build_array(jsonb_build_object(
    'responsibility', responsibilities, 'percent', contribution_percent))
WHERE NULLIF(BTRIM(responsibilities), '') IS NOT NULL
  AND contribution_percent IS NOT NULL;

UPDATE project
SET troubleshooting_items = jsonb_build_array(troubleshooting)
WHERE NULLIF(BTRIM(troubleshooting), '') IS NOT NULL;
