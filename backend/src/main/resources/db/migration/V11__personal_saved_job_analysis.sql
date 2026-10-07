ALTER TABLE personal_saved_job ADD COLUMN description TEXT;

CREATE TABLE personal_saved_job_analysis (
    personal_saved_job_id BIGINT PRIMARY KEY REFERENCES personal_saved_job(id),
    status VARCHAR(20) NOT NULL CHECK (status IN ('COMPLETED', 'FAILED')),
    result_json JSONB,
    failure_reason VARCHAR(200),
    analyzed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
