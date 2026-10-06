package com.devjob.dashboard;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.dashboard.service.DashboardService;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Tag("database")
@EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_s16_test")
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class DashboardDatabaseTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired DashboardService service;
    @Autowired MockMvc mvc;

    @Test void aggregatesOnlyTheOwnerAndRanksEligibleJobs() throws Exception {
        String marker = "s16_" + UUID.randomUUID();
        long owner = user(marker + "_owner"), other = user(marker + "_other");
        long source = jdbc.queryForObject("insert into job_source (code, name) values (?, 'S16') returning id", Long.class, marker);
        long company = jdbc.queryForObject("insert into company (name) values (?) returning id", Long.class, marker);
        long java = skill("Java"), docker = skill("Docker");
        jdbc.update("insert into user_skill (user_id, skill_id, created_at) values (?, ?, now())", owner, java);
        jdbc.update("insert into profiles (user_id, name, desired_role, updated_at) values (?, 'S16', ?, now())", owner, marker);
        long[] jobs = new long[5];
        for (int i = 0; i < jobs.length; i++) {
            jobs[i] = job(source, company, marker + i, marker + " 개발자 " + i);
            jdbc.update("insert into ai_analysis (job_posting_id, status, updated_at) values (?, 'COMPLETED', now())", jobs[i]);
            jdbc.update("insert into job_skill (job_posting_id, skill_id, requirement_type) values (?, ?, 'REQUIRED')", jobs[i], java);
            if (i < 3) jdbc.update("insert into job_skill (job_posting_id, skill_id, requirement_type) values (?, ?, 'PREFERRED')", jobs[i], docker);
        }
        long planned = application(owner, jobs[0], "PLANNED", "2026-10-10 05:00:00+00");
        application(other, jobs[1], "INTERVIEW", "2026-10-09 05:00:00+00");
        jdbc.update("insert into bookmark (user_id, job_posting_id) values (?, ?)", owner, jobs[0]);
        jdbc.update("insert into bookmark (user_id, job_posting_id) values (?, ?)", other, jobs[2]);

        var dashboard = service.get(owner);
        assertThat(dashboard.applicationCounts()).containsEntry(com.devjob.application.entity.ApplicationStatus.PLANNED, 1L)
                .containsEntry(com.devjob.application.entity.ApplicationStatus.INTERVIEW, 0L);
        assertThat(dashboard.bookmarkCount()).isEqualTo(1);
        assertThat(dashboard.nextActions()).extracting(a -> a.applicationId()).containsExactly(planned);
        assertThat(dashboard.recommendedJobs()).extracting(j -> j.id()).containsExactly(jobs[4], jobs[3], jobs[2]);
        assertThat(dashboard.recommendedJobs()).extracting(j -> j.matchRate()).containsExactly(100, 100, 50);
        assertThat(dashboard.skillGapPreview()).extracting(s -> s.name()).containsExactly("Docker");
        assertThat(service.get(other).nextActions()).extracting(a -> a.jobId()).containsExactly(jobs[1]);

        mvc.perform(get("/api/dashboard")).andExpect(status().isUnauthorized());
        var principal = UsernamePasswordAuthenticationToken.authenticated(new CurrentUser(owner, "owner@example.com"), null, List.of());
        mvc.perform(get("/api/dashboard").with(authentication(principal)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.bookmarkCount").value(1))
                .andExpect(jsonPath("$.nextActions[0].jobTitle").value(marker + " 개발자 0"));
    }

    private long user(String email) {
        return jdbc.queryForObject("insert into users (email, password_hash, created_at) values (?, 's16', now()) returning id",
                Long.class, email + "@example.com");
    }
    private long skill(String name) { return jdbc.queryForObject("select id from skill where name = ?", Long.class, name); }
    private long job(long source, long company, String external, String title) {
        return jdbc.queryForObject("insert into job_posting (job_source_id, company_id, external_id, title, source_url, created_at, updated_at) "
                + "values (?, ?, ?, ?, 'https://example.com', now(), now()) returning id", Long.class, source, company, external, title);
    }
    private long application(long user, long job, String status, String schedule) {
        return jdbc.queryForObject("insert into application (user_id, job_posting_id, current_status, applied_date, next_schedule_at, created_at, updated_at) "
                + "values (?, ?, ?, case when ? in ('INTERVIEW', 'APPLIED') then current_date else null end, cast(? as timestamptz), now(), now()) returning id",
                Long.class, user, job, status, status, schedule);
    }
}
