-- Only seed the disposable S11 database; never reset existing data.
DO $$ BEGIN
    IF current_database() <> 'devjob_s11_test' THEN RAISE EXCEPTION 'Not the S11 test database'; END IF;
    IF EXISTS (SELECT 1 FROM job_source WHERE code = 'S11_BROWSER') THEN RAISE EXCEPTION 'S11 fixture already exists'; END IF;
END $$;
INSERT INTO job_source(code,name) VALUES ('S11_BROWSER','S11 browser fixture');
INSERT INTO company(name) VALUES ('S11 Browser Company');
INSERT INTO job_posting(job_source_id,external_id,company_id,title,description,posted_date,deadline_date,source_url,created_at,updated_at)
SELECT s.id,'s11-browser-' || n,c.id,'S11 Backend ' || lpad(n::text,2,'0'),
    'Original text',DATE '2026-10-01',DATE '2026-11-01','https://example.com/s11/' || n,now(),now()
FROM job_source s CROSS JOIN company c CROSS JOIN generate_series(1,24) n
WHERE s.code='S11_BROWSER' AND c.name='S11 Browser Company';
