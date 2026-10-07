package com.devjob.savedjob;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.user.entity.User;
import com.devjob.user.repository.UserRepository;
import com.devjob.job.entity.*;
import com.devjob.job.model.NormalizedJobPosting;
import com.devjob.job.repository.*;
import com.devjob.bookmark.repository.BookmarkRepository;
import com.devjob.analysis.adapter.AnalysisGateway;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.mockito.Mockito.*;

@Tag("database")
@EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_personal_test")
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class PersonalSavedJobDatabaseTest {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;
    @Autowired JobPostingRepository jobs;
    @Autowired JobSourceRepository sources;
    @Autowired CompanyRepository companies;
    @Autowired BookmarkRepository bookmarks;
    @MockitoBean AnalysisGateway gateway;
    private User owner, other;
    private static final String JOB = """
            {"url":"https://example.com/jobs/123","companyName":"테스트 회사","title":"백엔드 개발자",
             "role":"백엔드 개발","careerLevel":"신입","location":"서울","employmentType":"정규직",
             "deadlineDate":"2026-10-20","note":"지원 준비"}
            """;
    @BeforeEach void setup() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_personal_test");
        owner = users.saveAndFlush(new User("personal-owner@example.com", "hash"));
        other = users.saveAndFlush(new User("personal-other@example.com", "hash"));
    }
    private UsernamePasswordAuthenticationToken auth(User user) {
        return UsernamePasswordAuthenticationToken.authenticated(new CurrentUser(user.getId(), user.getEmail()), null, List.of());
    }
    @Test void manualOwnershipDuplicateApplicationHistoryAndSoftDelete() throws Exception {
        mvc.perform(post("/api/me/saved-jobs").with(authentication(auth(owner))).with(csrf())
                .contentType("application/json").content(JOB)).andExpect(status().isCreated());
        Long id = jdbc.queryForObject("select id from personal_saved_job where user_id=?", Long.class, owner.getId());
        mvc.perform(post("/api/me/saved-jobs").with(authentication(auth(owner))).with(csrf())
                .contentType("application/json").content(JOB)).andExpect(status().isConflict());
        mvc.perform(get("/api/me/saved-jobs/" + id).with(authentication(auth(other)))).andExpect(status().isNotFound());
        mvc.perform(put("/api/me/saved-jobs/" + id).with(authentication(auth(other))).with(csrf())
                .contentType("application/json").content(JOB)).andExpect(status().isNotFound());
        mvc.perform(post("/api/applications").with(authentication(auth(other))).with(csrf())
                .contentType("application/json").content("{\"personalSavedJobId\":" + id + ",\"status\":\"PLANNED\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/applications").with(authentication(auth(owner))).with(csrf())
                .contentType("application/json").content("{\"personalSavedJobId\":" + id + ",\"status\":\"PLANNED\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.job").isEmpty())
                .andExpect(jsonPath("$.personalSavedJob.title").value("백엔드 개발자"));
        Long applicationId = jdbc.queryForObject("select id from application where personal_saved_job_id=?", Long.class, id);
        mvc.perform(patch("/api/applications/" + applicationId + "/status").with(authentication(auth(owner))).with(csrf())
                .contentType("application/json").content("{\"status\":\"APPLIED\",\"appliedDate\":\"2026-10-07\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.currentStatus").value("APPLIED"));
        var source = sources.saveAndFlush(new JobSource("PERSONAL_TEST", "Test"));
        var company = companies.saveAndFlush(new Company("수집 회사"));
        var collected = jobs.saveAndFlush(new JobPosting(source, company, new NormalizedJobPosting(
                "external-1", "수집 회사", "서버 개발자", "본문", null, null, null, null, null,
                "https://example.com/collected")));
        assertThat(bookmarks.add(owner.getId(), collected.getId())).isEqualTo(1);
        mvc.perform(get("/api/me/saved-jobs").with(authentication(auth(owner))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.items[0].kind").value("MANUAL"))
                .andExpect(jsonPath("$.items[1].kind").value("COLLECTED"))
                .andExpect(jsonPath("$.items[0].applicationStatus").value("APPLIED"));
        mvc.perform(delete("/api/me/saved-jobs/" + id).with(authentication(auth(other))).with(csrf()))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/me/saved-jobs/" + id).with(authentication(auth(owner))).with(csrf()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/me/saved-jobs/" + id).with(authentication(auth(owner)))).andExpect(status().isNotFound());
        mvc.perform(get("/api/applications").with(authentication(auth(owner))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].personalSavedJob.title").value("백엔드 개발자"));
        assertThat(jdbc.queryForObject("select count(*) from application_status_history h join application a on a.id=h.application_id where a.user_id=?",
                Long.class, owner.getId())).isEqualTo(2);
    }
    @Test void invalidInputAndAuthentication() throws Exception {
        mvc.perform(get("/api/me/saved-jobs")).andExpect(status().isUnauthorized());
        for (String body : List.of(JOB.replace("https://example.com/jobs/123", "javascript:alert(1)"),
                JOB.replace("테스트 회사", " "), JOB.replace("2026-10-20", "2026-02-30")))
            mvc.perform(post("/api/me/saved-jobs").with(authentication(auth(owner))).with(csrf())
                    .contentType("application/json").content(body)).andExpect(status().isBadRequest());
    }
    @Test void manualAnalysisUsesPastedBodyAndKeepsOwnership() throws Exception {
        String body = JOB.replace("\"note\":\"지원 준비\"", "\"note\":\"지원 준비\",\"description\":\"Java 필수, Docker 우대\"");
        mvc.perform(post("/api/me/saved-jobs").with(authentication(auth(owner))).with(csrf())
                .contentType("application/json").content(body)).andExpect(status().isCreated());
        Long id = jdbc.queryForObject("select id from personal_saved_job where user_id=?", Long.class, owner.getId());
        mvc.perform(post("/api/me/saved-jobs/" + id + "/analysis").with(authentication(auth(other))).with(csrf()))
                .andExpect(status().isNotFound());
        when(gateway.available()).thenReturn(true);
        when(gateway.analyze("백엔드 개발자", "Java 필수, Docker 우대"))
                .thenReturn("{\"skills\":[{\"name\":\"Java\",\"requirementType\":\"REQUIRED\"},"
                        + "{\"name\":\"Docker\",\"requirementType\":\"PREFERRED\"},"
                        + "{\"name\":\"java\",\"requirementType\":\"PREFERRED\"}]}");
        mvc.perform(post("/api/me/saved-jobs/" + id + "/analysis").with(authentication(auth(owner))).with(csrf()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.requiredSkills[0]").value("Java"))
                .andExpect(jsonPath("$.preferredSkills[0]").value("Docker"))
                .andExpect(jsonPath("$.preferredSkills.length()").value(1));
        mvc.perform(get("/api/me/saved-jobs").with(authentication(auth(owner))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].analysisStatus").value("COMPLETED"));
        mvc.perform(get("/api/me/saved-jobs/" + id + "/analysis").with(authentication(auth(owner))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.requiredSkills[0]").value("Java"));
        mvc.perform(put("/api/me/saved-jobs/" + id).with(authentication(auth(owner))).with(csrf())
                .contentType("application/json").content(body.replace("Java 필수", "Spring 필수")))
                .andExpect(status().isOk());
        mvc.perform(get("/api/me/saved-jobs/" + id + "/analysis").with(authentication(auth(owner))))
                .andExpect(status().isNotFound());
    }
}
