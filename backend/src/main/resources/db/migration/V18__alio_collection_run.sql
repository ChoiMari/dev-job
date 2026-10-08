create table job_collection_run (
    source_code varchar(100) primary key,
    run_id uuid not null,
    status varchar(30) not null,
    started_at timestamptz not null,
    updated_at timestamptz not null,
    finished_at timestamptz,
    processed_pages integer not null default 0,
    created_count integer not null default 0,
    duplicate_count integer not null default 0,
    rejected_count integer not null default 0,
    failed_count integer not null default 0,
    source_error varchar(50),
    constraint ck_job_collection_run_counts check (
        processed_pages >= 0 and created_count >= 0 and duplicate_count >= 0
        and rejected_count >= 0 and failed_count >= 0)
);
