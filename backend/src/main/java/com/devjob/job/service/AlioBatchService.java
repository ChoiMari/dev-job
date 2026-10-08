package com.devjob.job.service;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.job.adapter.ExternalJobPosting;
import com.devjob.job.adapter.JobSearchCondition;
import com.devjob.job.adapter.JobSourceAdapter;
import com.devjob.job.adapter.JobSourceDescriptor;
import com.devjob.job.adapter.alio.AlioAdapter;
import com.devjob.job.adapter.alio.AlioSourceException;
import com.devjob.job.dto.AlioBatchStatus;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Executor;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Explicit operator run. Each provider page is saved independently and progress is durable. */
@Service
public class AlioBatchService {
    private static final Logger log = LoggerFactory.getLogger(AlioBatchService.class);
    private static final String SOURCE = "ALIO_RECRUITMENT";
    private static final int PAGE_SIZE = 20;
    private static final int MAX_PROVIDER_PAGES = 1000;
    private final JdbcTemplate jdbc;
    private final JobCollectionService collection;
    private final AlioAdapter alio;
    private final Executor executor;
    private final Set<String> administrators;

    public AlioBatchService(JdbcTemplate jdbc, JobCollectionService collection, AlioAdapter alio,
            @Qualifier("alioBatchExecutor") Executor executor,
            @Value("${ALIO_BATCH_ADMIN_EMAILS:}") String adminEmails) {
        this.jdbc = jdbc;
        this.collection = collection;
        this.alio = alio;
        this.executor = executor;
        this.administrators = Arrays.stream(adminEmails.split(","))
                .map(email -> email.strip().toLowerCase(Locale.ROOT)).filter(email -> !email.isEmpty())
                .collect(Collectors.toUnmodifiableSet());
    }

    public AlioBatchStatus start(CurrentUser user) {
        requireAdmin(user);
        if (!alio.isConfigured()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE);
        UUID runId = UUID.randomUUID();
        var claimed = jdbc.query("""
                insert into job_collection_run (source_code, run_id, status, started_at, updated_at)
                values (?, ?, 'RUNNING', now(), now())
                on conflict (source_code) do update
                set run_id = excluded.run_id, status = 'RUNNING', started_at = now(),
                    updated_at = now(), finished_at = null, processed_pages = 0,
                    created_count = 0, duplicate_count = 0, rejected_count = 0,
                    failed_count = 0, source_error = null
                where job_collection_run.status <> 'RUNNING'
                   or job_collection_run.updated_at < now() - interval '10 minutes'
                returning run_id
                """, (rs, rowNum) -> rs.getObject(1, UUID.class), SOURCE, runId);
        if (claimed.isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT);
        try {
            executor.execute(() -> run(runId));
        } catch (RuntimeException exception) {
            finish(runId, JobCollectionResult.Status.STORAGE_FAILED, 0, 0, 0, 0, 0, "EXECUTOR_UNAVAILABLE");
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE);
        }
        return status(user);
    }

    public AlioBatchStatus status(CurrentUser user) {
        requireAdmin(user);
        return jdbc.query("""
                select run_id, status, started_at, updated_at, finished_at, processed_pages,
                       created_count, duplicate_count, rejected_count, failed_count, source_error
                from job_collection_run where source_code = ?
                """, (rs, rowNum) -> readStatus(rs), SOURCE).stream()
                .findFirst().orElseGet(AlioBatchStatus::idle);
    }

    private void run(UUID runId) {
        int created = 0, duplicates = 0, rejected = 0, failed = 0, pages = 0;
        String sourceError = null;
        var status = JobCollectionResult.Status.COMPLETED;
        try {
            boolean last = false;
            for (int page = 0; page < MAX_PROVIDER_PAGES; page++) {
                AlioAdapter.Page fetched;
                try {
                    fetched = alio.fetchBatchPage(page);
                } catch (AlioSourceException exception) {
                    status = pages == 0 ? JobCollectionResult.Status.SOURCE_FAILED
                            : JobCollectionResult.Status.PARTIAL_FAILURE;
                    sourceError = exception.reason().name();
                    break;
                }
                List<ExternalJobPosting> rows = fetched.jobs();
                JobSourceAdapter pageAdapter = new JobSourceAdapter() {
                    public JobSourceDescriptor source() { return alio.source(); }
                    public List<ExternalJobPosting> fetchJobs(JobSearchCondition condition) { return rows; }
                };
                var result = collection.collect(pageAdapter, new JobSearchCondition(null, page, PAGE_SIZE));
                created += result.created();
                duplicates += result.duplicates();
                rejected += result.rejected();
                failed += result.failed();
                pages++;
                if (result.status() == JobCollectionResult.Status.STORAGE_FAILED) {
                    status = JobCollectionResult.Status.STORAGE_FAILED;
                } else if (result.status() != JobCollectionResult.Status.COMPLETED) {
                    status = JobCollectionResult.Status.PARTIAL_FAILURE;
                }
                if (!progress(runId, pages, created, duplicates, rejected, failed)) return;
                if (status == JobCollectionResult.Status.STORAGE_FAILED) break;
                if (fetched.last()) { last = true; break; }
            }
            if (!last && status == JobCollectionResult.Status.COMPLETED) {
                status = JobCollectionResult.Status.PARTIAL_FAILURE;
                sourceError = "PAGE_LIMIT";
            }
        } catch (RuntimeException exception) {
            log.warn("ALIO batch failed: reason=INTERNAL_FAILURE");
            status = pages == 0 ? JobCollectionResult.Status.SOURCE_FAILED
                    : JobCollectionResult.Status.PARTIAL_FAILURE;
            sourceError = "INTERNAL_FAILURE";
        }
        finish(runId, status, pages, created, duplicates, rejected, failed, sourceError);
        log.info("ALIO batch: status={}, pages={}, created={}, duplicates={}, rejected={}, failed={}",
                status, pages, created, duplicates, rejected, failed);
    }

    private boolean progress(UUID runId, int pages, int created, int duplicates, int rejected, int failed) {
        return jdbc.update("""
                update job_collection_run set updated_at = now(), processed_pages = ?, created_count = ?,
                    duplicate_count = ?, rejected_count = ?, failed_count = ?
                where source_code = ? and run_id = ? and status = 'RUNNING'
                """, pages, created, duplicates, rejected, failed, SOURCE, runId) == 1;
    }

    private void finish(UUID runId, JobCollectionResult.Status status, int pages, int created,
            int duplicates, int rejected, int failed, String sourceError) {
        jdbc.update("""
                update job_collection_run set status = ?, updated_at = now(), finished_at = now(),
                    processed_pages = ?, created_count = ?, duplicate_count = ?, rejected_count = ?,
                    failed_count = ?, source_error = ? where source_code = ? and run_id = ?
                """, status.name(), pages, created, duplicates, rejected, failed, sourceError, SOURCE, runId);
    }

    private static AlioBatchStatus readStatus(ResultSet rs) throws SQLException {
        var started = rs.getTimestamp("started_at");
        var updated = rs.getTimestamp("updated_at");
        var finished = rs.getTimestamp("finished_at");
        return new AlioBatchStatus(rs.getObject("run_id", UUID.class), rs.getString("status"),
                started == null ? null : started.toInstant(), updated == null ? null : updated.toInstant(),
                finished == null ? null : finished.toInstant(), rs.getInt("processed_pages"),
                rs.getInt("created_count"), rs.getInt("duplicate_count"), rs.getInt("rejected_count"),
                rs.getInt("failed_count"), rs.getString("source_error"));
    }

    private void requireAdmin(CurrentUser user) {
        if (user == null || user.email() == null
                || !administrators.contains(user.email().toLowerCase(Locale.ROOT)))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    }

    @Configuration
    static class Execution {
        @Bean("alioBatchExecutor")
        ThreadPoolTaskExecutor alioBatchExecutor() {
            var executor = new ThreadPoolTaskExecutor();
            executor.setCorePoolSize(1);
            executor.setMaxPoolSize(1);
            executor.setQueueCapacity(0);
            executor.setThreadNamePrefix("alio-batch-");
            executor.initialize();
            return executor;
        }
    }
}
