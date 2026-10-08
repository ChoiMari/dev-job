package com.devjob.job.adapter.alio;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.job.adapter.ExternalJobPosting;
import com.devjob.job.adapter.JobSearchCondition;
import com.devjob.job.adapter.JobSourceAdapter;
import com.devjob.job.adapter.JobSourceDescriptor;
import com.devjob.job.adapter.RecruitmentDetails;
import com.devjob.job.service.JobCollectionResult;
import com.devjob.job.service.JobCollectionService;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import static com.devjob.job.service.JobCollectionResult.Status.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** End-to-end read regression on a new, disposable B11 database; no provider calls. */
@Tag("database")
@EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_b11_test")
@SpringBootTest
@AutoConfigureMockMvc
class AlioBackendRegressionDatabaseTest {
    @Autowired JobCollectionService collection;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;

    @Test
    void repeatPartialFailureAndOutageKeepStoredJobsAndCrmReadable() throws Exception {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_b11_test");
        var condition = new JobSearchCondition(null, 0, 20);
        var alioRows = new AtomicReference<>(List.of(alio("첫 개발 공고", true, false)));
        var alio = new JobSourceAdapter() {
            public JobSourceDescriptor source() { return new JobSourceDescriptor("ALIO_RECRUITMENT", "청년일자리 공공기관 채용"); }
            public List<ExternalJobPosting> fetchJobs(JobSearchCondition requested) { return alioRows.get(); }
        };
        var work24 = new JobSourceAdapter() {
            public JobSourceDescriptor source() { return new JobSourceDescriptor("WORK24_OPEN_RECRUITMENT", "고용24 공채속보"); }
            public List<ExternalJobPosting> fetchJobs(JobSearchCondition requested) {
                return List.of(new ExternalJobPosting("123", "다른 기관", "보안 채용", null,
                        null, null, null, null, null, "https://example.com/work24/123"));
            }
        };
        assertThat(collection.collect(alio, condition)).isEqualTo(new JobCollectionResult(COMPLETED, 1, 0, 0, 0));
        assertThat(collection.collect(work24, condition)).isEqualTo(new JobCollectionResult(COMPLETED, 1, 0, 0, 0));
        long jobId = jdbc.queryForObject("select id from job_posting where external_id='123' and job_source_id="
                + "(select id from job_source where code='ALIO_RECRUITMENT')", Long.class);
        jdbc.update("insert into users (email, password_hash, created_at) values (?, ?, now())",
                "b11-regression@example.com", "fixture");
        long userId = jdbc.queryForObject("select id from users where email=?", Long.class,
                "b11-regression@example.com");
        jdbc.update("insert into bookmark (user_id, job_posting_id) values (?, ?)", userId, jobId);
        jdbc.update("insert into application (user_id, job_posting_id, current_status, created_at, updated_at) "
                + "values (?, ?, 'PLANNED', now(), now())", userId, jobId);
        var principal = UsernamePasswordAuthenticationToken.authenticated(
                new CurrentUser(userId, "b11-regression@example.com"), null, List.of());

        for (String sort : List.of("latest", "matchRate")) {
            mvc.perform(get("/api/jobs").with(authentication(principal)).param("source", "ALIO_RECRUITMENT")
                    .param("sort", sort)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalElements").value(1))
                    .andExpect(jsonPath("$.items[0].id").value(jobId))
                    .andExpect(jsonPath("$.items[0].source").value("ALIO_RECRUITMENT"));
            mvc.perform(get("/api/jobs").with(authentication(principal)).param("source", "WORK24_OPEN_RECRUITMENT")
                    .param("sort", sort)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.totalElements").value(1));
        }

        var outage = new JobSourceAdapter() {
            public JobSourceDescriptor source() { return alio.source(); }
            public List<ExternalJobPosting> fetchJobs(JobSearchCondition requested) {
                throw new AlioSourceException(AlioSourceException.Reason.PROVIDER_CONNECTION);
            }
        };
        assertThat(collection.collect(outage, condition).status()).isEqualTo(SOURCE_FAILED);
        mvc.perform(get("/api/jobs/" + jobId).with(authentication(principal)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.description").value("지원 자격\nJava"))
                .andExpect(jsonPath("$.sourceUrl").value("https://example.com/alio/123"));
        mvc.perform(get("/api/bookmarks").with(authentication(principal)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].job.id").value(jobId));
        mvc.perform(get("/api/applications").with(authentication(principal)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].job.id").value(jobId));

        alioRows.set(List.of(alio("수정 개발 공고", false, true),
                new ExternalJobPosting("bad", "공공기관", "개발자", null, null, null, null,
                        null, null, "해당없음"),
                new ExternalJobPosting("456", "다른 공공기관", "데이터 개발", null, null, null, null,
                        null, null, "https://example.com/alio/456")));
        assertThat(collection.collect(alio, condition))
                .isEqualTo(new JobCollectionResult(PARTIAL_FAILURE, 1, 1, 1, 1));
        assertThat(jdbc.queryForObject("select count(*) from job_posting", Integer.class)).isEqualTo(3);
        assertThat(jdbc.queryForObject("select id from job_posting where source_url=?", Long.class,
                "https://example.com/alio/123")).isEqualTo(jobId);
        mvc.perform(get("/api/jobs/" + jobId).with(authentication(principal)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("수정 개발 공고"))
                .andExpect(jsonPath("$.description").value("지원 자격\nJava"));
        mvc.perform(get("/api/jobs").with(authentication(principal)).param("source", "ALIO_RECRUITMENT"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(get("/api/bookmarks").with(authentication(principal)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].job.id").value(jobId));
        mvc.perform(get("/api/applications").with(authentication(principal)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].job.id").value(jobId));
    }

    private ExternalJobPosting alio(String title, boolean detailAvailable, boolean detailFailed) {
        return new ExternalJobPosting("123", "공공기관", title,
                detailAvailable ? "지원 자격\nJava" : null, null, "신입", "서울",
                "2026-10-01", "2026-10-20", "https://example.com/alio/123",
                detailAvailable ? new RecruitmentDetails(List.of(), List.of()) : null, detailFailed);
    }
}
