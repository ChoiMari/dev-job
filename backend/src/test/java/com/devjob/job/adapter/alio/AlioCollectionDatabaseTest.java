package com.devjob.job.adapter.alio;

import com.devjob.job.adapter.ExternalJobPosting;
import com.devjob.job.adapter.JobSearchCondition;
import com.devjob.job.adapter.JobSourceAdapter;
import com.devjob.job.adapter.JobSourceDescriptor;
import com.devjob.job.adapter.RecruitmentDetails;
import com.devjob.job.repository.JobRecruitmentDetailRepository;
import com.devjob.job.service.JobCollectionResult;
import com.devjob.job.service.JobCollectionService;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import static com.devjob.job.service.JobCollectionResult.Status.*;
import static org.assertj.core.api.Assertions.*;

/** Runs only against a disposable ALIO integration database. */
@Tag("database")
@EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_alio_test")
@SpringBootTest
class AlioCollectionDatabaseTest {
    @Autowired JobCollectionService collection;
    @Autowired JobRecruitmentDetailRepository details;
    @Autowired JdbcTemplate jdbc;
    private final AtomicReference<ExternalJobPosting> response = new AtomicReference<>();
    private final JobSourceAdapter adapter = new JobSourceAdapter() {
        public JobSourceDescriptor source() { return new JobSourceDescriptor("ALIO_RECRUITMENT", "청년일자리 채용"); }
        public List<ExternalJobPosting> fetchJobs(JobSearchCondition condition) { return List.of(response.get()); }
    };

    @BeforeEach
    void cleanDisposableDatabase() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_alio_test");
        jdbc.update("delete from application_status_history");
        jdbc.update("delete from application");
        jdbc.update("delete from bookmark");
        jdbc.update("delete from job_skill");
        jdbc.update("delete from ai_analysis");
        jdbc.update("delete from job_posting");
        jdbc.update("delete from company");
        jdbc.update("delete from job_source");
        jdbc.update("delete from users");
        response.set(posting("첫 제목", true, false));
    }

    @Test
    void repeatCollectionUpdatesDetailAndKeepsBookmarkAndApplicationJobId() {
        var condition = new JobSearchCondition(null, 0, 1);
        assertThat(collection.collect(adapter, condition)).isEqualTo(new JobCollectionResult(COMPLETED, 1, 0, 0, 0));
        long jobId = jdbc.queryForObject("select id from job_posting", Long.class);
        jdbc.update("insert into users (email, password_hash, created_at) values (?, ?, now())",
                "alio-test@example.com", "fixture");
        long userId = jdbc.queryForObject("select id from users where email = ?", Long.class, "alio-test@example.com");
        long skillId = jdbc.queryForObject("select id from skill order by id limit 1", Long.class);
        jdbc.update("insert into ai_analysis (job_posting_id, status, result_json, analyzed_at, updated_at) "
                + "values (?, 'COMPLETED', '{\"skills\":[]}'::jsonb, now(), now())", jobId);
        jdbc.update("insert into job_skill (job_posting_id, skill_id, requirement_type) values (?, ?, 'REQUIRED')",
                jobId, skillId);
        jdbc.update("insert into bookmark (user_id, job_posting_id) values (?, ?)", userId, jobId);
        jdbc.update("insert into application (user_id, job_posting_id, current_status, created_at, updated_at) "
                + "values (?, ?, 'PLANNED', now(), now())", userId, jobId);
        response.set(posting("수정 제목", true, false));
        assertThat(collection.collect(adapter, condition)).isEqualTo(new JobCollectionResult(COMPLETED, 0, 1, 0, 0));
        assertThat(jdbc.queryForObject("select id from job_posting", Long.class)).isEqualTo(jobId);
        assertThat(jdbc.queryForObject("select title from job_posting", String.class)).isEqualTo("수정 제목");
        assertThat(details.find(jobId).steps()).hasSize(1);
        assertThat(details.find(jobId).attachments()).hasSize(1);
        assertThat(jdbc.queryForObject("select status from ai_analysis where job_posting_id = ?", String.class, jobId))
                .isEqualTo("FAILED");
        assertThat(jdbc.queryForObject("select count(*) from job_skill where job_posting_id = ?", Integer.class, jobId))
                .isZero();
        assertThat(jdbc.queryForObject("select count(*) from bookmark where job_posting_id = ?", Integer.class, jobId)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from application where job_posting_id = ?", Integer.class, jobId)).isEqualTo(1);
    }

    @Test
    void detailFailureRetainsPreviousDetailAndReportsPartialFailure() {
        var condition = new JobSearchCondition(null, 0, 1);
        collection.collect(adapter, condition);
        long jobId = jdbc.queryForObject("select id from job_posting", Long.class);
        String before = jdbc.queryForObject("select description from job_posting", String.class);
        response.set(posting("수정 제목", false, true));
        assertThat(collection.collect(adapter, condition)).isEqualTo(new JobCollectionResult(PARTIAL_FAILURE, 0, 1, 0, 1));
        assertThat(jdbc.queryForObject("select description from job_posting", String.class)).isEqualTo(before);
        assertThat(details.find(jobId).steps()).hasSize(1);
        assertThat(jdbc.queryForObject("select title from job_posting", String.class)).isEqualTo("수정 제목");
    }

    private ExternalJobPosting posting(String title, boolean withDetail, boolean failed) {
        var detail = withDetail ? new RecruitmentDetails(
                List.of(new RecruitmentDetails.Step(10, 1, "서류", 2, null, null, null)),
                List.of(new RecruitmentDetails.Attachment(20, 1, "공고.pdf", "A", "https://example.com/file.pdf"))) : null;
        return new ExternalJobPosting("123", "공공기관", title, withDetail ? "지원 자격\nJava" : null,
                "정규직", "신입", "서울", "2026-10-01", "2026-10-20",
                "https://example.com/recruit/123", detail, failed);
    }
}
