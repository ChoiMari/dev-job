package com.devjob.analysis;

import com.devjob.analysis.dto.SkillDemandQuery;
import com.devjob.analysis.service.SkillDemandService;
import java.util.UUID;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Tag("database")
@EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_s14_test")
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class SkillDemandDatabaseTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired SkillDemandService service;
    @Autowired MockMvc mvc;

    @Test void aggregatesCompletedJobsWithFiltersAndPagination() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_s14_test");
        String prefix = "S14_" + UUID.randomUUID();
        long source = jdbc.queryForObject("insert into job_source (code, name) values (?, 'S14') returning id", Long.class, prefix);
        long company = jdbc.queryForObject("insert into company (name) values (?) returning id", Long.class, prefix);
        long java = jdbc.queryForObject("select id from skill where name = 'Java'", Long.class);
        long docker = jdbc.queryForObject("select id from skill where name = 'Docker'", Long.class);
        long first = job(source, company, prefix + "1", prefix + " 백엔드 개발자", "2026-10-01");
        long second = job(source, company, prefix + "2", prefix + " 백엔드 엔지니어", "2026-10-02");
        long pending = job(source, company, prefix + "3", prefix + " 백엔드 개발자", "2026-10-03");
        long other = job(source, company, prefix + "4", prefix + " 프론트엔드 개발자", "2026-10-04");
        analysis(first, "COMPLETED"); analysis(second, "COMPLETED"); analysis(pending, "PENDING"); analysis(other, "COMPLETED");
        skill(first, java); skill(first, docker); skill(second, java); skill(pending, docker); skill(other, docker);

        var result = service.find(new SkillDemandQuery("2026-10-01", "2026-10-02", prefix + " 백엔드", 0, 1));
        assertThat(result.analyzedJobCount()).isEqualTo(2);
        assertThat(result.totalElements()).isEqualTo(2);
        assertThat(result.items()).hasSize(1);
        assertThat(result.items().get(0).skill().name()).isEqualTo("Java");
        assertThat(result.items().get(0).jobCount()).isEqualTo(2);
        assertThat(result.items().get(0).ratio()).isEqualTo(1.0);
        var next = service.find(new SkillDemandQuery("2026-10-01", "2026-10-02", prefix + " 백엔드", 1, 1));
        assertThat(next.items().get(0).skill().name()).isEqualTo("Docker");
        assertThat(next.items().get(0).ratio()).isEqualTo(0.5);
        var empty = service.find(new SkillDemandQuery("2026-09-01", "2026-09-30", prefix + " 백엔드", 0, 20));
        assertThat(empty.analyzedJobCount()).isZero();
        assertThat(empty.totalElements()).isZero();
        assertThat(empty.items()).isEmpty();
    }

    private long job(long source, long company, String external, String title, String posted) {
        return jdbc.queryForObject("insert into job_posting (job_source_id, company_id, external_id, title, posted_date, source_url, created_at, updated_at) "
                + "values (?, ?, ?, ?, ?::date, 'https://example.com', now(), now()) returning id", Long.class,
                source, company, external, title, posted);
    }
    private void analysis(long job, String status) {
        jdbc.update("insert into ai_analysis (job_posting_id, status, updated_at) values (?, ?, now())", job, status);
    }
    private void skill(long job, long id) {
        jdbc.update("insert into job_skill (job_posting_id, skill_id, requirement_type) values (?, ?, 'REQUIRED')", job, id);
    }

    @Test void endpointRequiresSessionAndRejectsInvalidPeriod() throws Exception {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_s14_test");
        mvc.perform(get("/api/analytics/skills")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/analytics/skills").with(user("s14"))
                .param("dateFrom", "2026-10-07").param("dateTo", "2026-10-06"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        mvc.perform(get("/api/analytics/skills").with(user("s14"))
                .param("desiredRole", "no-such-s14-role"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.analyzedJobCount").value(0))
                .andExpect(jsonPath("$.items.length()").value(0));
    }
}
