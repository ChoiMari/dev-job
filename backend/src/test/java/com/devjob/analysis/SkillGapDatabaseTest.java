package com.devjob.analysis;

import com.devjob.analysis.service.SkillGapService;
import com.devjob.auth.dto.CurrentUser;
import java.util.UUID;
import java.util.List;
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
@EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_s15_test")
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class SkillGapDatabaseTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired SkillGapService service;
    @Autowired MockMvc mvc;

    @Test void ranksOnlyMissingSkillsFromCompletedRoleJobsAndKeepsOwnersSeparate() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_s15_test");
        String marker = "s15_" + UUID.randomUUID();
        long owner = user(marker + "_owner"), other = user(marker + "_other");
        long java = skill("Java"), docker = skill("Docker"), spring = skill("Spring Boot");
        long redis = skill("Redis"), aws = skill("Git"), react = skill("React");
        long python = skill("Python"), sql = skill("SQL"), fastApi = skill("FastAPI");
        jdbc.update("insert into profiles (user_id, name, desired_role, updated_at) values (?, 'S15', ?, now())",
                owner, marker + " 백엔드");
        jdbc.update("insert into user_skill (user_id, skill_id, created_at) values (?, ?, now())", owner, java);
        jdbc.update("insert into user_skill (user_id, skill_id, created_at) values (?, ?, now())", other, redis);
        long project = jdbc.queryForObject("insert into project (user_id, name, start_date, created_at, updated_at) "
                + "values (?, 'S15', current_date, now(), now()) returning id", Long.class, owner);
        jdbc.update("insert into project_skill (project_id, skill_id) values (?, ?)", project, docker);
        long source = source(marker), company = company(marker);
        long[] jobs = new long[5];
        for (int i = 0; i < jobs.length; i++) {
            jobs[i] = job(source, company, marker + i, marker + " 백엔드 개발자");
            analysis(jobs[i], "COMPLETED");
        }
        for (int i = 0; i < 4; i++) jobSkill(jobs[i], spring, "REQUIRED");
        for (int i = 0; i < 2; i++) jobSkill(jobs[i], redis, "REQUIRED");
        jobSkill(jobs[2], redis, "PREFERRED");
        for (int i = 0; i < 4; i++) jobSkill(jobs[i], aws, "PREFERRED");
        jobSkill(jobs[0], java, "REQUIRED"); jobSkill(jobs[0], docker, "REQUIRED");
        jobSkill(jobs[0], react, "REQUIRED"); jobSkill(jobs[0], python, "PREFERRED");
        jobSkill(jobs[0], sql, "PREFERRED"); jobSkill(jobs[0], fastApi, "PREFERRED");
        long pending = job(source, company, marker + "pending", marker + " 백엔드 개발자");
        analysis(pending, "PENDING"); jobSkill(pending, spring, "REQUIRED");
        long unrelated = job(source, company, marker + "other", marker + " 프론트엔드 개발자");
        analysis(unrelated, "COMPLETED"); jobSkill(unrelated, spring, "REQUIRED");

        var result = service.find(owner, null);
        assertThat(result.available()).isTrue();
        assertThat(result.desiredRole()).isEqualTo(marker + " 백엔드");
        assertThat(result.analyzedJobCount()).isEqualTo(5);
        assertThat(result.provisional()).isTrue();
        assertThat(result.totalMissingSkills()).isEqualTo(7);
        assertThat(result.items()).hasSize(5);
        assertThat(result.items()).extracting(item -> item.skill().name())
                .containsExactly("Spring Boot", "Redis", "Git", "React", "FastAPI");
        assertThat(result.items().get(0).requiredJobCount()).isEqualTo(4);
        assertThat(result.items().get(0).preferredJobCount()).isZero();
        assertThat(result.items().get(0).demandRatio()).isEqualTo(0.8);
        assertThat(result.items().get(0).priorityScore()).isEqualTo(80.0);
        assertThat(result.items().get(1).priorityScore()).isEqualTo(50.0);
        assertThat(service.find(other, marker + " 백엔드").items())
                .extracting(item -> item.skill().name()).contains("Java", "Docker").doesNotContain("Redis");
        assertThat(service.find(owner, "no-such-s15-role").reason()).isEqualTo("INSUFFICIENT_SAMPLE");
    }

    @Test void holdsRankingUnderFiveJobsAndMarksFiveToNineteenProvisional() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_s15_test");
        String marker = "s15_" + UUID.randomUUID();
        long owner = user(marker), source = source(marker), company = company(marker);
        jdbc.update("insert into user_skill (user_id, skill_id, created_at) values (?, ?, now())", owner, skill("Java"));
        for (int i = 0; i < 4; i++) {
            long job = job(source, company, marker + i, marker + " 분석 대상");
            analysis(job, "COMPLETED"); jobSkill(job, skill("Docker"), "REQUIRED");
        }
        var insufficient = service.find(owner, marker);
        assertThat(insufficient.available()).isFalse();
        assertThat(insufficient.analyzedJobCount()).isEqualTo(4);
        assertThat(insufficient.items()).isEmpty();
        assertThat(insufficient.reason()).isEqualTo("INSUFFICIENT_SAMPLE");
        for (int i = 4; i < 20; i++) {
            long job = job(source, company, marker + i, marker + " 분석 대상");
            analysis(job, "COMPLETED");
        }
        var enough = service.find(owner, marker);
        assertThat(enough.available()).isTrue();
        assertThat(enough.analyzedJobCount()).isEqualTo(20);
        assertThat(enough.provisional()).isFalse();
        assertThat(enough.items().get(0).demandRatio()).isEqualTo(0.2);
        assertThat(enough.items().get(0).priorityScore()).isEqualTo(20.0);
        assertThat(service.find(user(marker + "_empty"), marker).reason()).isEqualTo("USER_SKILLS_EMPTY");
        long fullyOwned = user(marker + "_owned");
        jdbc.update("insert into user_skill (user_id, skill_id, created_at) values (?, ?, now())", fullyOwned, skill("Docker"));
        var complete = service.find(fullyOwned, marker);
        assertThat(complete.available()).isTrue();
        assertThat(complete.totalMissingSkills()).isZero();
        assertThat(complete.items()).isEmpty();
        for (int i = 0; i < 5; i++) {
            long job = job(source, company, marker + "no-skill" + i, marker + " 기술 없음");
            analysis(job, "COMPLETED");
        }
        assertThat(service.find(owner, marker + " 기술 없음").reason()).isEqualTo("NO_JOB_SKILLS");
    }

    @Test void endpointRequiresAuthenticationAndRejectsOversizedRole() throws Exception {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_s15_test");
        mvc.perform(get("/api/me/skill-gap")).andExpect(status().isUnauthorized());
        long owner = user("s15_" + UUID.randomUUID());
        var principal = UsernamePasswordAuthenticationToken.authenticated(
                new CurrentUser(owner, "s15@example.com"), null, List.of());
        mvc.perform(get("/api/me/skill-gap").with(authentication(principal))
                .param("desiredRole", "x".repeat(201)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        mvc.perform(get("/api/me/skill-gap").with(authentication(principal)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.reason").value("USER_SKILLS_EMPTY"));
    }

    private long user(String email) {
        return jdbc.queryForObject("insert into users (email, password_hash, created_at) values (?, 's15', now()) returning id",
                Long.class, email.toLowerCase() + "@example.com");
    }
    private long skill(String name) { return jdbc.queryForObject("select id from skill where name = ?", Long.class, name); }
    private long source(String code) { return jdbc.queryForObject("insert into job_source (code, name) values (?, 'S15') returning id", Long.class, code); }
    private long company(String name) { return jdbc.queryForObject("insert into company (name) values (?) returning id", Long.class, name); }
    private long job(long source, long company, String external, String title) {
        return jdbc.queryForObject("insert into job_posting (job_source_id, company_id, external_id, title, source_url, created_at, updated_at) "
                + "values (?, ?, ?, ?, 'https://example.com', now(), now()) returning id", Long.class, source, company, external, title);
    }
    private void analysis(long job, String status) {
        jdbc.update("insert into ai_analysis (job_posting_id, status, updated_at) values (?, ?, now())", job, status);
    }
    private void jobSkill(long job, long skill, String type) {
        jdbc.update("insert into job_skill (job_posting_id, skill_id, requirement_type) values (?, ?, ?)", job, skill, type);
    }
}
