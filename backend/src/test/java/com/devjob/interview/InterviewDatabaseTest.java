package com.devjob.interview;

import com.devjob.application.repository.ApplicationRepository;
import com.devjob.application.repository.ApplicationStatusHistoryRepository;
import com.devjob.auth.dto.CurrentUser;
import com.devjob.interview.repository.InterviewScheduleRepository;
import com.devjob.job.entity.*;
import com.devjob.job.model.NormalizedJobPosting;
import com.devjob.job.repository.*;
import com.devjob.user.entity.User;
import com.devjob.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import java.util.List;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Tag("database") @EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_b06_test")
@SpringBootTest @AutoConfigureMockMvc @Transactional
class InterviewDatabaseTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired JobPostingRepository jobs;
    @Autowired CompanyRepository companies;
    @Autowired JobSourceRepository sources;
    @Autowired ApplicationRepository applications;
    @Autowired ApplicationStatusHistoryRepository histories;
    @Autowired InterviewScheduleRepository interviews;
    @Autowired EntityManager entityManager;
    @Autowired JdbcTemplate jdbc;
    User owner, other;
    long job;

    @BeforeEach void seed() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_b06_test");
        owner = users.saveAndFlush(new User("b06-owner@example.com", "hash"));
        other = users.saveAndFlush(new User("b06-other@example.com", "hash"));
        var source = sources.save(new JobSource("B06_TEST", "Test"));
        job = jobs.saveAndFlush(new JobPosting(source, companies.save(new Company("B06 Company")),
                new NormalizedJobPosting("Backend", "B06 Company", "Backend", "Original", null, null,
                        null, null, null, "https://example.com/b06"))).getId();
    }
    private RequestPostProcessor as(User user) {
        return authentication(UsernamePasswordAuthenticationToken.authenticated(
                new CurrentUser(user.getId(), user.getEmail()), null, List.of()));
    }
    private long application(User user) throws Exception {
        var response = mvc.perform(post("/api/applications").with(as(user)).with(csrf()).contentType("application/json")
                .content("{\"jobId\":" + job + ",\"status\":\"PLANNED\",\"nextScheduleAt\":\"2026-10-12T10:00:00+09:00\"}"))
                .andExpect(status().isCreated()).andReturn();
        return json.readTree(response.getResponse().getContentAsString()).get("id").asLong();
    }
    private long create(User user, String extra) throws Exception {
        var response = mvc.perform(post("/api/me/interviews").with(as(user)).with(csrf()).contentType("application/json")
                .content("{\"title\":\"First interview\",\"startsAt\":\"2026-10-15T14:00:00+09:00\",\"timeZone\":\"Asia/Seoul\"" + extra + "}"))
                .andExpect(status().isCreated()).andReturn();
        return json.readTree(response.getResponse().getContentAsString()).get("id").asLong();
    }

    @Test void optionalConnectionAndChangesRemainSeparateFromApplication() throws Exception {
        long applicationId = application(owner);
        long interviewId = create(owner, "");
        // Equal starts are valid because users may have overlapping interviews.
        create(owner, "");
        mvc.perform(get("/api/me/interviews").with(as(owner))).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(patch("/api/me/interviews/" + interviewId).with(as(owner)).with(csrf())
                .contentType("application/json").content("{\"applicationId\":" + applicationId
                        + ",\"title\":\"Rescheduled\",\"startsAt\":\"2026-11-01T09:00:00-05:00\",\"timeZone\":\"America/New_York\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.applicationId").value(applicationId));
        entityManager.clear();
        mvc.perform(get("/api/me/interviews/" + interviewId).with(as(owner))).andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Rescheduled"))
                .andExpect(jsonPath("$.startsAt").value("2026-11-01T09:00:00-05:00"));
        mvc.perform(get("/api/applications/" + applicationId).with(as(owner)))
                .andExpect(jsonPath("$.currentStatus").value("PLANNED"))
                .andExpect(jsonPath("$.nextScheduleAt").value("2026-10-12T01:00:00Z"));
        assertThat(histories.findByApplicationIdOrderByChangedAtAscIdAsc(applicationId)).hasSize(1);
        mvc.perform(patch("/api/applications/" + applicationId + "/status").with(as(owner)).with(csrf())
                .contentType("application/json").content("{\"status\":\"APPLIED\",\"appliedDate\":\"2026-10-10\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.currentStatus").value("APPLIED"));
        assertThat(histories.findByApplicationIdOrderByChangedAtAscIdAsc(applicationId)).hasSize(2);
        mvc.perform(get("/api/me/interviews/" + interviewId).with(as(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.applicationId").value(applicationId));
        mvc.perform(patch("/api/me/interviews/" + interviewId).with(as(owner)).with(csrf())
                .contentType("application/json").content("{\"applicationId\":null}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.applicationId").isEmpty());
    }

    @Test void cancellationIsIdempotentAndReactivationPersists() throws Exception {
        long id = create(owner, "");
        var first = mvc.perform(post("/api/me/interviews/" + id + "/cancel").with(as(owner)).with(csrf()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED")).andReturn();
        String cancelledAt = json.readTree(first.getResponse().getContentAsString()).get("cancelledAt").asText();
        mvc.perform(post("/api/me/interviews/" + id + "/cancel").with(as(owner)).with(csrf()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.cancelledAt").value(cancelledAt));
        entityManager.clear();
        mvc.perform(get("/api/me/interviews/" + id).with(as(owner)))
                .andExpect(jsonPath("$.status").value("CANCELLED"));
        mvc.perform(post("/api/me/interviews/" + id + "/reactivate").with(as(owner)).with(csrf()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("SCHEDULED"));
        mvc.perform(post("/api/me/interviews/" + id + "/reactivate").with(as(owner)).with(csrf()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.cancelledAt").isEmpty());
        entityManager.clear();
        assertThat(interviews.findById(id).orElseThrow().getCancelledAt()).isNull();
    }

    @Test void ownershipTimeZoneAndSecurityBoundaries() throws Exception {
        long othersApplication = application(other);
        mvc.perform(post("/api/me/interviews").with(as(owner)).with(csrf()).contentType("application/json")
                .content("{\"title\":\"Wrong owner\",\"startsAt\":\"2026-10-15T14:00:00+09:00\",\"timeZone\":\"Asia/Seoul\",\"applicationId\":" + othersApplication + "}"))
                .andExpect(status().isForbidden());
        long id = create(owner, "");
        mvc.perform(patch("/api/me/interviews/" + id).with(as(owner)).with(csrf()).contentType("application/json")
                .content("{\"applicationId\":" + othersApplication + "}"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/me/interviews/" + id).with(as(other))).andExpect(status().isForbidden());
        mvc.perform(post("/api/me/interviews/" + id + "/cancel").with(as(other)).with(csrf()))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/me/interviews").with(as(other))).andExpect(jsonPath("$.items").isEmpty());
        for (String body : List.of(
                "{\"title\":\"Bad\",\"startsAt\":\"2026-10-15T14:00:00+08:00\",\"timeZone\":\"Asia/Seoul\"}",
                "{\"title\":\"Bad\",\"startsAt\":\"2026-03-08T02:30:00-05:00\",\"timeZone\":\"America/New_York\"}",
                "{\"title\":\"Bad\",\"startsAt\":\"2026-10-15T14:00:00+09:00\",\"timeZone\":\"+09:00\"}")) {
            mvc.perform(post("/api/me/interviews").with(as(owner)).with(csrf()).contentType("application/json")
                    .content(body)).andExpect(status().isBadRequest());
        }
        mvc.perform(patch("/api/me/interviews/" + id).with(as(owner)).with(csrf()).contentType("application/json")
                .content("{\"startsAt\":\"2026-10-16T14:00:00+09:00\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/me/interviews")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/me/interviews").with(as(owner)).contentType("application/json")
                .content("{}")) .andExpect(status().isForbidden());
    }
}
