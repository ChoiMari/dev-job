CREATE TABLE job_recruitment_step (
    job_posting_id BIGINT NOT NULL REFERENCES job_posting(id) ON DELETE CASCADE,
    external_id BIGINT NOT NULL,
    sort_order INTEGER NOT NULL,
    title TEXT NOT NULL,
    openings INTEGER,
    applicants INTEGER,
    competition_rate TEXT,
    event_date TEXT,
    PRIMARY KEY (job_posting_id, external_id)
);

CREATE TABLE job_recruitment_attachment (
    job_posting_id BIGINT NOT NULL REFERENCES job_posting(id) ON DELETE CASCADE,
    external_id BIGINT NOT NULL,
    sort_order INTEGER NOT NULL,
    name TEXT NOT NULL,
    file_type TEXT,
    url TEXT NOT NULL,
    PRIMARY KEY (job_posting_id, external_id)
);
