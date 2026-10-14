package com.devjob.analysis;

import com.devjob.analysis.adapter.AnalysisGateway;
import com.devjob.analysis.repository.JobSkillRepository;
import com.devjob.auth.dto.CurrentUser;
import com.devjob.job.entity.*;
import com.devjob.job.model.NormalizedJobPosting;
import com.devjob.job.repository.*;
import com.devjob.user.entity.User;
import com.devjob.user.repository.UserRepository;
import java.util.List;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Tag("database")
@EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_s12_test")
@SpringBootTest
@AutoConfigureMockMvc
class AnalysisDatabaseTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired JobPostingRepository jobs;
    @Autowired JobSourceRepository sources;
    @Autowired CompanyRepository companies;
    @Autowired JobSkillRepository jobSkills;
    @MockitoBean AnalysisGateway gateway;
    long jobId;
    UsernamePasswordAuthenticationToken principal;

    @BeforeEach void seed() throws Exception {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_s12_test");
        var user = users.saveAndFlush(new User("s12-" + java.util.UUID.randomUUID() + "@example.com", "hash"));
        principal = UsernamePasswordAuthenticationToken.authenticated(new CurrentUser(user.getId(), user.getEmail()), null, List.of());
        var source = sources.save(new JobSource("S12_" + java.util.UUID.randomUUID(), "Test"));
        jobId = jobs.saveAndFlush(new JobPosting(source, companies.save(new Company("S12 Company")),
                new NormalizedJobPosting("S12 job", "S12 Company", "S12 job", "Postgres, Java, Spring Boot",
                        null, null, null, null, null, "https://example.com/s12"))).getId();
        mvc.perform(post("/api/bookmarks").with(authentication(principal)).with(csrf())
                .contentType("application/json").content("{\"jobId\":" + jobId + "}"))
                .andExpect(status().isCreated());
    }
    private org.springframework.test.web.servlet.ResultActions request() throws Exception {
        when(gateway.available()).thenReturn(true);
        return mvc.perform(post("/api/jobs/" + jobId + "/analysis").with(authentication(principal)).with(csrf()));
    }
    private void await(String status) throws Exception {
        for (int i = 0; i < 80; i++) {
            String actual = com.jayway.jsonpath.JsonPath.read(mvc.perform(get("/api/jobs/" + jobId + "/analysis")
                    .with(authentication(principal))).andReturn().getResponse().getContentAsString(), "$.status");
            if (status.equals(actual)) return;
            Thread.sleep(100);
        }
        fail("analysis did not reach " + status);
    }
    @Test void successNormalizesDeduplicatesPersistsAndReuses() throws Exception {
        when(gateway.analyze(anyString(), anyString())).thenReturn("{\"skills\":["
                + "{\"name\":\"Postgres\",\"requirementType\":\"PREFERRED\"},"
                + "{\"name\":\"PostgreSQL\",\"requirementType\":\"REQUIRED\"},"
                + "{\"name\":\"New S12 Skill\",\"requirementType\":\"PREFERRED\"}]}");
        request().andExpect(status().isAccepted()).andExpect(jsonPath("$.status").value("PENDING"));
        await("COMPLETED");
        request().andExpect(status().isOk()).andExpect(jsonPath("$.requiredSkills[0].name").value("PostgreSQL"));
        mvc.perform(get("/api/jobs/" + jobId).with(authentication(principal)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.description").value("Postgres, Java, Spring Boot"))
                .andExpect(jsonPath("$.analysis.status").value("COMPLETED"))
                .andExpect(jsonPath("$.requiredSkills[0].skill.name").value("PostgreSQL"));
        assertThat(jobSkills.findForJob(jobId)).hasSize(2);
        assertThat(jdbc.queryForObject("select result_json::text from ai_analysis where job_posting_id = ?", String.class, jobId))
                .contains("PostgreSQL", "New S12 Skill").doesNotContain("Postgres\\\"");
        assertThat(jdbc.queryForObject("select count(*) from skill_alias where normalized_name = 'new s12 skill'", Integer.class))
                .isEqualTo(1);
        verify(gateway, times(1)).analyze(anyString(), anyString());
    }
    @Test void anotherAccountSeesUnanalyzedStateUntilRequestAndThenReusesResult() throws Exception {
        when(gateway.analyze(anyString(), anyString())).thenReturn("{\"skills\":[]}");
        request().andExpect(status().isAccepted());
        await("COMPLETED");
        var other = users.saveAndFlush(new User("s12-reuse-" + java.util.UUID.randomUUID() + "@example.com", "hash"));
        var otherPrincipal = UsernamePasswordAuthenticationToken.authenticated(
                new CurrentUser(other.getId(), other.getEmail()), null, List.of());
        mvc.perform(post("/api/bookmarks").with(authentication(otherPrincipal)).with(csrf())
                .contentType("application/json").content("{\"jobId\":" + jobId + "}"))
                .andExpect(status().isCreated());
        mvc.perform(get("/api/jobs/" + jobId).with(authentication(otherPrincipal)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.analysis").doesNotExist());
        mvc.perform(get("/api/jobs/" + jobId + "/analysis").with(authentication(otherPrincipal)))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/jobs/" + jobId + "/analysis")
                .with(authentication(otherPrincipal)).with(csrf()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("COMPLETED"));
        mvc.perform(get("/api/jobs/" + jobId + "/analysis").with(authentication(otherPrincipal)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("COMPLETED"));
        mvc.perform(get("/api/jobs/" + jobId).with(authentication(otherPrincipal)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.analysis.status").value("COMPLETED"));
        verify(gateway, times(1)).analyze(anyString(), anyString());
    }
    @Test void malformedOutputFailsWithoutSkillsAndRetrySucceeds() throws Exception {
        when(gateway.analyze(anyString(), anyString())).thenReturn("{\"skills\":\"Java\"}")
                .thenReturn("{\"skills\":[{\"name\":\"Java\",\"requirementType\":\"REQUIRED\"}]}");
        request().andExpect(status().isAccepted());
        await("FAILED");
        assertThat(jobSkills.findForJob(jobId)).isEmpty();
        assertThat(jdbc.queryForObject("select result_json::text from ai_analysis where job_posting_id = ?", String.class, jobId))
                .isNull();
        mvc.perform(get("/api/jobs/" + jobId).with(authentication(principal))).andExpect(status().isOk())
                .andExpect(jsonPath("$.analysis.status").value("FAILED"));
        request().andExpect(status().isAccepted());
        await("COMPLETED");
        assertThat(jobSkills.findForJob(jobId)).hasSize(1);
        verify(gateway, times(2)).analyze(anyString(), anyString());
    }
    @Test void providerFailurePreservesCrmAndDoesNotRetryAutomatically() throws Exception {
        when(gateway.analyze(anyString(), anyString())).thenThrow(new IllegalStateException("private provider details"));
        request().andExpect(status().isAccepted());
        await("FAILED");
        mvc.perform(get("/api/jobs/" + jobId).with(authentication(principal))).andExpect(status().isOk())
                .andExpect(jsonPath("$.description").value("Postgres, Java, Spring Boot"));
        mvc.perform(get("/api/jobs").with(authentication(principal))).andExpect(status().isOk());
        mvc.perform(get("/api/jobs/" + jobId + "/analysis").with(authentication(principal)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.failureReason").isNotEmpty());
        verify(gateway, times(1)).analyze(anyString(), anyString());
    }
    @Test void pendingDuplicateUsesOneProviderCallAndMissingAnalysisIs404() throws Exception {
        var next = jobs.saveAndFlush(new JobPosting(sources.save(new JobSource("S12_EXTRA_" + java.util.UUID.randomUUID(), "Test")),
                companies.save(new Company("Extra")), new NormalizedJobPosting("Extra", "Extra", "Extra", "Java",
                        null, null, null, null, null, "https://example.com/extra"))).getId();
        mvc.perform(get("/api/jobs/" + next + "/analysis").with(authentication(principal)))
                .andExpect(status().isNotFound());
        var gate = new java.util.concurrent.CountDownLatch(1);
        when(gateway.analyze(anyString(), anyString())).thenAnswer(invocation -> {
            if (!gate.await(5, java.util.concurrent.TimeUnit.SECONDS)) throw new IllegalStateException("timeout");
            return "{\"skills\":[]}";
        });
        try {
            request().andExpect(status().isAccepted());
            request().andExpect(status().isAccepted()).andExpect(jsonPath("$.status").value("PENDING"));
        } finally { gate.countDown(); }
        await("COMPLETED");
        verify(gateway, times(1)).analyze(anyString(), anyString());
    }
    @Test void analysisEndpointRequiresSessionAndCsrfAndRejectsUnknownJob() throws Exception {
        mvc.perform(get("/api/jobs/" + jobId + "/analysis")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/jobs/" + jobId + "/analysis")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/jobs/" + jobId + "/analysis").with(authentication(principal)))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/jobs/0/analysis").with(authentication(principal)).with(csrf()))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/jobs/9223372036854775807/analysis").with(authentication(principal)).with(csrf()))
                .andExpect(status().isNotFound());
        var other = users.saveAndFlush(new User("s12-other-" + java.util.UUID.randomUUID() + "@example.com", "hash"));
        var otherPrincipal = UsernamePasswordAuthenticationToken.authenticated(
                new CurrentUser(other.getId(), other.getEmail()), null, List.of());
        mvc.perform(post("/api/jobs/" + jobId + "/analysis").with(authentication(otherPrincipal)).with(csrf()))
                .andExpect(status().isForbidden());
        verifyNoInteractions(gateway);
    }
    @Test void missingProviderKeyRejectsRequestWithoutFailedRow() throws Exception {
        when(gateway.available()).thenReturn(false);
        mvc.perform(post("/api/jobs/" + jobId + "/analysis").with(authentication(principal)).with(csrf()))
                .andExpect(status().isServiceUnavailable());
        assertThat(jdbc.queryForObject("select count(*) from ai_analysis where job_posting_id=?", Integer.class, jobId))
                .isZero();
        mvc.perform(get("/api/jobs/" + jobId).with(authentication(principal))).andExpect(status().isOk());
    }
}
