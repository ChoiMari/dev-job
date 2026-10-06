-- Apply only to a new disposable S17 database after Flyway V1-V8.
DO $$ BEGIN
    IF current_database() <> 'devjob_s17_test' OR EXISTS (SELECT 1 FROM job_posting) THEN
        RAISE EXCEPTION 'S17 fixture requires an empty disposable database';
    END IF;
END $$;

INSERT INTO job_source(code, name) VALUES ('S17_FIXTURE', 'S17 fixture');
INSERT INTO company(name) VALUES ('S17 Company');
INSERT INTO job_posting(job_source_id, external_id, company_id, title, description,
    employment_type, career_requirement, location, posted_date, deadline_date,
    source_url, created_at, updated_at)
SELECT js.id, 's17-' || n, c.id, 'S17 Backend ' || n, 'Java and Docker',
    '정규직', '신입', '서울', DATE '2026-10-01', DATE '2026-11-30',
    'https://example.com/s17/' || n, now(), now()
FROM job_source js CROSS JOIN company c CROSS JOIN generate_series(1, 7) n
WHERE js.code = 'S17_FIXTURE' AND c.name = 'S17 Company';

INSERT INTO ai_analysis(job_posting_id, status, result_json, analyzed_at, updated_at)
SELECT id, 'COMPLETED', '{"skills":[]}'::jsonb, now(), now()
FROM job_posting WHERE external_id <> 's17-7';
INSERT INTO job_skill(job_posting_id, skill_id, requirement_type)
SELECT jp.id, s.id, CASE WHEN s.name = 'Java' THEN 'REQUIRED' ELSE 'PREFERRED' END
FROM job_posting jp CROSS JOIN skill s
WHERE jp.external_id <> 's17-7' AND s.name IN ('Java', 'Docker');
