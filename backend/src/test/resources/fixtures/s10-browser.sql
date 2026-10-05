-- Only a new, empty, disposable S10 DB may receive this fixture.
BEGIN;
DO $$ BEGIN
    IF current_database() <> 'devjob_s10_test' THEN RAISE EXCEPTION 'Not the S10 test database'; END IF;
    IF EXISTS (SELECT 1 FROM job_posting) OR EXISTS (SELECT 1 FROM company) THEN
        RAISE EXCEPTION 'Fixture requires empty job and company tables';
    END IF;
END $$;
INSERT INTO job_source(code,name) VALUES ('S10_BROWSER','Browser fixture');
INSERT INTO company(name) SELECT 'S10 Fixture ' || n FROM generate_series(1,23) AS n;
INSERT INTO job_posting(job_source_id,external_id,company_id,title,description,employment_type,
    career_requirement,location,posted_date,deadline_date,source_url,created_at,updated_at)
SELECT s.id,'s10-browser-' || c.id,c.id,'Backend ' || c.name,
    E'Java\n<script>window.s10Injected=true</script>','정규직','신입','서울',
    NULL,NULL,'https://example.com/s10/1',now(),now()
FROM company c CROSS JOIN job_source s WHERE s.code='S10_BROWSER';
COMMIT;
