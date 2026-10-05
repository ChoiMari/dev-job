-- Apply only after dbTest on a new disposable S08 DB; never truncate existing data.
DO $$ BEGIN
    IF current_database() <> 'devjob_s08_test' THEN RAISE EXCEPTION 'Not the S08 test database'; END IF;
    IF EXISTS (SELECT 1 FROM job_posting) THEN RAISE EXCEPTION 'Fixture requires an empty disposable jobs database'; END IF;
END $$;
INSERT INTO job_source(code,name) VALUES ('S08_BROWSER','Browser fixture');
INSERT INTO company(name)
SELECT CASE WHEN n=1 THEN 'Alpha' ELSE 'Fixture ' || n END FROM generate_series(1,23) AS n;
INSERT INTO job_posting(job_source_id,external_id,company_id,title,description,employment_type,
    career_requirement,location,posted_date,deadline_date,source_url,created_at,updated_at)
SELECT s.id,'browser-' || c.id,c.id,'Backend ' || c.name,
    E'Java\n<script>window.s08Injected=true</script>','정규직','신입','서울',
    DATE '2026-10-01',DATE '2026-11-01','https://example.com/s08/1',now(),now()
FROM company c CROSS JOIN job_source s WHERE s.code='S08_BROWSER';
