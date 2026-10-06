package com.devjob.job;

import com.devjob.analysis.entity.AIAnalysis;
import com.devjob.analysis.entity.JobSkill;
import com.devjob.analysis.repository.AIAnalysisRepository;
import com.devjob.analysis.repository.JobSkillRepository;
import com.devjob.auth.dto.CurrentUser;
import com.devjob.job.entity.*;
import com.devjob.job.model.NormalizedJobPosting;
import com.devjob.job.repository.*;
import com.devjob.skill.repository.SkillRepository;
import com.devjob.user.entity.User;
import com.devjob.user.repository.UserRepository;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.*;
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
@EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_s13_test")
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class JobMatchDatabaseTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired JobPostingRepository jobs;
    @Autowired CompanyRepository companies;
    @Autowired JobSourceRepository sources;
    @Autowired SkillRepository skills;
    @Autowired AIAnalysisRepository analyses;
    @Autowired JobSkillRepository jobSkills;
    UsernamePasswordAuthenticationToken owner;
    UsernamePasswordAuthenticationToken other;
    UsernamePasswordAuthenticationToken newcomer;
    long complete, low, pending, empty, javaId;

    @BeforeEach void seed() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_s13_test");
        var user = users.saveAndFlush(new User("s13-owner@example.com", "hash"));
        var stranger = users.saveAndFlush(new User("s13-other@example.com", "hash"));
        var newcomerUser = users.saveAndFlush(new User("s13-new@example.com", "hash"));
        owner = principal(user); other = principal(stranger); newcomer = principal(newcomerUser);
        var source = sources.save(new JobSource("S13", "Test"));
        var company = companies.save(new Company("S13 Company"));
        complete = posting(source, company, "Complete", "2026-10-04");
        low = posting(source, company, "Low", "2026-10-03");
        pending = posting(source, company, "Pending", "2026-10-02");
        empty = posting(source, company, "Empty", "2026-10-01");
        var java = skills.findByNormalizedName("java").orElseThrow();
        var react = skills.findByNormalizedName("react").orElseThrow();
        var sql = skills.findByNormalizedName("sql").orElseThrow();
        javaId = java.getId();
        jdbc.update("insert into user_skill(user_id, skill_id, created_at) values (?, ?, current_timestamp)", user.getId(), javaId);
        jdbc.update("insert into project(user_id, name, start_date, created_at, updated_at) values (?, 'S13', current_date, current_timestamp, current_timestamp)", user.getId());
        Long projectId = jdbc.queryForObject("select id from project where user_id = ?", Long.class, user.getId());
        jdbc.update("insert into project_skill(project_id, skill_id) values (?, ?), (?, ?)", projectId, javaId, projectId, react.getId());
        jdbc.update("insert into user_skill(user_id, skill_id, created_at) values (?, ?, current_timestamp)", stranger.getId(), sql.getId());
        complete(complete); complete(low); complete(empty);
        analyses.save(new AIAnalysis(jobs.findById(pending).orElseThrow()));
        jobSkills.save(new JobSkill(jobs.findById(complete).orElseThrow(), java, JobSkill.RequirementType.REQUIRED));
        jobSkills.save(new JobSkill(jobs.findById(complete).orElseThrow(), react, JobSkill.RequirementType.PREFERRED));
        jobSkills.save(new JobSkill(jobs.findById(complete).orElseThrow(), sql, JobSkill.RequirementType.REQUIRED));
        jobSkills.save(new JobSkill(jobs.findById(low).orElseThrow(), sql, JobSkill.RequirementType.REQUIRED));
        jobSkills.flush();
    }
    private UsernamePasswordAuthenticationToken principal(User user) {
        return UsernamePasswordAuthenticationToken.authenticated(new CurrentUser(user.getId(), user.getEmail()), null, List.of());
    }
    private long posting(JobSource source, Company company, String title, String date) {
        return jobs.save(new JobPosting(source, company, new NormalizedJobPosting(title, company.getName(), title, "body",
                null, null, null, LocalDate.parse(date), null, "https://example.com/" + title))).getId();
    }
    private void complete(long id) {
        var analysis = new AIAnalysis(jobs.findById(id).orElseThrow());
        analysis.completed("{}"); analyses.save(analysis);
    }
    @Test void comparesCombinedDeduplicatedSkillsAndHandlesMissingData() throws Exception {
        mvc.perform(get("/api/jobs/" + complete + "/match").with(authentication(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.available").value(true))
                .andExpect(jsonPath("$.required.total").value(2)).andExpect(jsonPath("$.required.matched[0].name").value("Java"))
                .andExpect(jsonPath("$.required.missing[0].name").value("SQL"))
                .andExpect(jsonPath("$.preferred.matched[0].name").value("React"))
                .andExpect(jsonPath("$.matchRate").value(67));
        mvc.perform(get("/api/jobs/" + empty + "/match").with(authentication(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.reason").value("NO_JOB_SKILLS"));
        mvc.perform(get("/api/jobs/" + pending + "/match").with(authentication(owner))).andExpect(status().isConflict());
        mvc.perform(get("/api/jobs/" + complete + "/match").with(authentication(other)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.matchRate").value(33));
        mvc.perform(get("/api/jobs/" + complete + "/match").with(authentication(newcomer)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.reason").value("USER_SKILLS_EMPTY"));
        mvc.perform(get("/api/jobs/" + complete).with(authentication(newcomer)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.matchRate").isEmpty());
    }
    @Test void filtersSortsAndPaginatesBeforeEnrichingResults() throws Exception {
        mvc.perform(get("/api/jobs").with(authentication(owner)).param("sort", "matchRate").param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(4))
                .andExpect(jsonPath("$.items[0].id").value(complete)).andExpect(jsonPath("$.items[0].matchRate").value(67));
        mvc.perform(get("/api/jobs").with(authentication(owner)).param("sort", "matchRate").param("size", "1").param("page", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(low));
        mvc.perform(get("/api/jobs").with(authentication(owner)).param("minMatchRate", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/jobs").with(authentication(owner)).param("minMatchRate", "0"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(get("/api/jobs").with(authentication(owner)).param("skillId", String.valueOf(javaId)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/jobs").with(authentication(owner)).param("skillId", String.valueOf(javaId)).param("sort", "matchRate"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
    }
    @Test void invalidFiltersAndMissingJobReturnContractErrors() throws Exception {
        for (var pair : new String[][]{{"skillId", "0"}, {"skillId", "abc"}, {"minMatchRate", "101"}, {"minMatchRate", "-1"}})
            mvc.perform(get("/api/jobs").with(authentication(owner)).param(pair[0], pair[1])).andExpect(status().isBadRequest());
        mvc.perform(get("/api/jobs/9223372036854775807/match").with(authentication(owner))).andExpect(status().isNotFound());
        mvc.perform(get("/api/jobs/" + complete + "/match")).andExpect(status().isUnauthorized());
    }
}
