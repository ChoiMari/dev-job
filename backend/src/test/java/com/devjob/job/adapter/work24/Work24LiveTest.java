package com.devjob.job.adapter.work24;

import com.devjob.job.adapter.JobSearchCondition;
import com.devjob.job.service.JobPostingNormalizer;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import static org.assertj.core.api.Assertions.*;

/** Explicit opt-in: one list request, one posting maximum, no DB or provider data in output. */
@Tag("work24-live")
@EnabledIfEnvironmentVariable(named = "WORK24_LIVE_TEST", matches = "true")
@EnabledIfEnvironmentVariable(named = "WORK24_AUTH_KEY", matches = ".+")
class Work24LiveTest {
    @Test
    void fetchesOneAuthorizedOpenRecruitmentPage() {
        var adapter = new Work24Adapter(System.getenv("WORK24_AUTH_KEY"), new Work24HttpClient());
        var rows = adapter.fetchJobs(new JobSearchCondition(null, 0, 1));
        // A legitimately empty list is allowed. Assertion messages never display provider fields.
        for (var row : rows) {
            com.devjob.job.model.NormalizedJobPosting normalized;
            try { normalized = new JobPostingNormalizer().normalize(row); }
            catch (RuntimeException exception) {
                throw new AssertionError("Work24 live response failed internal validation");
            }
            assertThat(normalized.externalId() != null && normalized.companyName() != null
                    && normalized.title() != null && normalized.sourceUrl() != null).isTrue();
        }
    }
}
