package com.devjob.application;

import com.devjob.application.entity.*;
import com.devjob.application.repository.*;
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
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Tag("database")
@EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_s11_test")
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ApplicationDatabaseTest {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired JobPostingRepository jobs;
    @Autowired CompanyRepository companies;
    @Autowired JobSourceRepository sources;
    @Autowired ApplicationRepository applications;
    @Autowired ApplicationStatusHistoryRepository histories;
    @Autowired JdbcTemplate jdbc;
    User first, second;
    JobSource source;
    long job, otherJob;
    @BeforeEach void seed() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_s11_test");
        first = users.saveAndFlush(new User("s11-first@example.com", "hash"));
        second = users.saveAndFlush(new User("s11-second@example.com", "hash"));
        source = sources.save(new JobSource("S11_TEST", "Test"));
        job = posting(source, "Backend"); otherJob = posting(source, "Frontend");
        jobs.flush();
    }
    long posting(JobSource source, String title) {
        return jobs.save(new JobPosting(source, companies.save(new Company("S11 Company")), new NormalizedJobPosting(
                title, "S11 Company", title, "Original", null, null, null, null, null, "https://example.com/job"))).getId();
    }
    UsernamePasswordAuthenticationToken auth(User user) {
        return UsernamePasswordAuthenticationToken.authenticated(new CurrentUser(user.getId(), user.getEmail()), null, List.of());
    }
    ResultActions create(User user, long jobId, String state, String extra) throws Exception {
        return mvc.perform(post("/api/applications").with(authentication(auth(user))).with(csrf())
                .contentType("application/json").content("{\"jobId\":" + jobId + ",\"status\":\"" + state + "\"" + extra + "}"));
    }
    long created(String state, String extra) throws Exception {
        create(first, job, state, extra).andExpect(status().isCreated()).andExpect(jsonPath("$.job.applicationStatus").value(state));
        return applications.findByUserIdAndJobIdInAndDeletedAtIsNull(first.getId(), List.of(job)).get(0).getId();
    }
    ResultActions change(User user, long id, String state, String extra) throws Exception {
        return mvc.perform(patch("/api/applications/" + id + "/status").with(authentication(auth(user))).with(csrf())
                .contentType("application/json").content("{\"status\":\"" + state + "\"" + extra + "}"));
    }
    @Test void registrationInitialHistoryAndFullProgressionPreserveAppliedDate() throws Exception {
        long id = created("INTERESTED", "");
        mvc.perform(get("/api/applications/" + id + "/history").with(authentication(auth(first))))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].fromStatus").isEmpty()).andExpect(jsonPath("$[0].toStatus").value("INTERESTED"));
        for (String state : List.of("PLANNED", "APPLIED", "DOCUMENT_PASSED", "INTERVIEW", "FINAL_PASSED"))
            change(first, id, state, state.equals("APPLIED") ? ",\"appliedDate\":\"2026-10-05\"" : "")
                    .andExpect(status().isOk()).andExpect(jsonPath("$.currentStatus").value(state));
        mvc.perform(get("/api/applications/" + id).with(authentication(auth(first))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.appliedDate").value("2026-10-05"));
        mvc.perform(get("/api/applications/" + id + "/history").with(authentication(auth(first))))
                .andExpect(jsonPath("$.length()").value(6)).andExpect(jsonPath("$[5].fromStatus").value("INTERVIEW"))
                .andExpect(jsonPath("$[5].toStatus").value("FINAL_PASSED"));
        change(first, id, "REJECTED", "").andExpect(status().isOk())
                .andExpect(jsonPath("$.appliedDate").value("2026-10-05"));
        change(first, id, "PLANNED", "").andExpect(status().isOk())
                .andExpect(jsonPath("$.appliedDate").isEmpty());
        change(first, id, "INTERVIEW", "").andExpect(status().isBadRequest());
        change(first, id, "INTERVIEW", ",\"appliedDate\":\"2026-10-06\"").andExpect(status().isOk());
        assertThat(histories.findByApplicationIdOrderByChangedAtAscIdAsc(id)).hasSize(9);
    }
    @Test void allInitialStatesRequireCorrectDatesAndDuplicateIsPerUserAndJob() throws Exception {
        create(first, job, "APPLIED", "").andExpect(status().isBadRequest());
        create(first, job, "PLANNED", ",\"appliedDate\":\"2026-10-05\"").andExpect(status().isBadRequest());
        create(first, job, "INTERVIEW", "").andExpect(status().isBadRequest());
        create(first, Long.MAX_VALUE, "PLANNED", "").andExpect(status().isNotFound());
        long id = created("APPLIED", ",\"appliedDate\":\"2026-10-05\"");
        create(first, job, "PLANNED", "").andExpect(status().isConflict());
        create(second, job, "PLANNED", "").andExpect(status().isCreated());
        change(first, id, "APPLIED", ",\"appliedDate\":\"2026-10-05\"").andExpect(status().isConflict());
        change(first, id, "INTERVIEW", "").andExpect(status().isOk());
        assertThat(histories.findByApplicationIdOrderByChangedAtAscIdAsc(id)).hasSize(2);
    }
    @Test void laterStatusesCanBeRegisteredWithAnActualApplicationDate() throws Exception {
        for (String state : List.of("DOCUMENT_PASSED", "INTERVIEW", "FINAL_PASSED", "REJECTED")) {
            long postingId = posting(source, state);
            create(first, postingId, state, "").andExpect(status().isBadRequest());
            create(first, postingId, state, ",\"appliedDate\":\"2026-10-05\"")
                    .andExpect(status().isCreated()).andExpect(jsonPath("$.currentStatus").value(state))
                    .andExpect(jsonPath("$.appliedDate").value("2026-10-05"));
        }
        create(first, posting(source, "withdrawn-before"), "WITHDRAWN", "")
                .andExpect(status().isCreated()).andExpect(jsonPath("$.appliedDate").isEmpty());
        create(first, posting(source, "withdrawn-after"), "WITHDRAWN", ",\"appliedDate\":\"2026-10-05\"")
                .andExpect(status().isCreated()).andExpect(jsonPath("$.appliedDate").value("2026-10-05"));
    }
    @Test void deleteHidesApplicationPreservesHistoryAndAllowsRegistrationAgain() throws Exception {
        long id = created("APPLIED", ",\"appliedDate\":\"2026-10-05\"");
        mvc.perform(delete("/api/applications/" + id).with(authentication(auth(second))).with(csrf()))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/applications/" + id).with(authentication(auth(first))).with(csrf()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/applications/" + id).with(authentication(auth(first))))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/applications/by-job/" + job).with(authentication(auth(first))))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/applications?status=APPLIED").with(authentication(auth(first))))
                .andExpect(jsonPath("$.totalElements").value(0));
        assertThat(histories.findByApplicationIdOrderByChangedAtAscIdAsc(id)).hasSize(1);
        create(first, job, "PLANNED", "").andExpect(status().isCreated());
        assertThat(applications.findByUserIdAndJobIdInAndDeletedAtIsNull(first.getId(), List.of(job))).hasSize(1);
    }
    @Test void metadataPatchPreservesOmittedFieldsClearsNullsAndDoesNotCreateHistory() throws Exception {
        long id = created("PLANNED", ",\"note\":\"first\",\"nextScheduleAt\":\"2026-10-10T14:00:00+09:00\"");
        mvc.perform(patch("/api/applications/" + id).with(authentication(auth(first))).with(csrf())
                .contentType("application/json").content("{\"note\":\" changed \"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.note").value("changed"))
                .andExpect(jsonPath("$.nextScheduleAt").value("2026-10-10T05:00:00Z"));
        mvc.perform(patch("/api/applications/" + id).with(authentication(auth(first))).with(csrf())
                .contentType("application/json").content("{\"note\":null,\"nextScheduleAt\":null}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.note").isEmpty()).andExpect(jsonPath("$.nextScheduleAt").isEmpty());
        change(first, id, "APPLIED", "").andExpect(status().isBadRequest());
        change(first, id, "WITHDRAWN", "").andExpect(status().isOk());
        change(first, id, "PLANNED", "").andExpect(status().isConflict());
        assertThat(histories.findByApplicationIdOrderByChangedAtAscIdAsc(id)).hasSize(2);
    }
    @Test void byJobReturnsOnlyOwnersApplicationDetails() throws Exception {
        long id = created("PLANNED", ",\"note\":\"Check documents\",\"nextScheduleAt\":\"2026-10-10T14:00:00+09:00\"");
        mvc.perform(get("/api/applications/by-job/" + job).with(authentication(auth(first))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.currentStatus").value("PLANNED"))
                .andExpect(jsonPath("$.note").value("Check documents"))
                .andExpect(jsonPath("$.nextScheduleAt").value("2026-10-10T05:00:00Z"));
        mvc.perform(get("/api/applications/by-job/" + job).with(authentication(auth(second))))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/applications/by-job/0").with(authentication(auth(first))))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/applications/by-job/" + job)).andExpect(status().isUnauthorized());
    }
    @Test void ownerOnlyReadsWritesAndHistoryAndUnknownIdsAreDistinct() throws Exception {
        long id = created("PLANNED", "");
        for (String suffix : List.of("", "/history"))
            mvc.perform(get("/api/applications/" + id + suffix).with(authentication(auth(second)))).andExpect(status().isForbidden());
        mvc.perform(patch("/api/applications/" + id).with(authentication(auth(second))).with(csrf())
                .contentType("application/json").content("{\"note\":\"attack\"}")).andExpect(status().isForbidden());
        change(second, id, "WITHDRAWN", "").andExpect(status().isForbidden());
        for (String value : List.of("0", "-1", "abc"))
            mvc.perform(get("/api/applications/" + value).with(authentication(auth(first)))).andExpect(status().isBadRequest());
        mvc.perform(get("/api/applications/" + Long.MAX_VALUE).with(authentication(auth(first)))).andExpect(status().isNotFound());
        mvc.perform(get("/api/applications").with(authentication(auth(second))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        assertThat(applications.findById(id).orElseThrow().getNote()).isNull();
    }
    @Test void pagedFilteredApplicationsAndJobsNeverLeakOtherUsersStatus() throws Exception {
        created("PLANNED", "");
        create(first, otherJob, "INTERESTED", "").andExpect(status().isCreated());
        create(second, job, "APPLIED", ",\"appliedDate\":\"2026-10-05\"").andExpect(status().isCreated());
        mvc.perform(get("/api/applications").with(authentication(auth(first))).param("size", "1"))
                .andExpect(jsonPath("$.totalElements").value(2)).andExpect(jsonPath("$.items[0].job.id").value(otherJob));
        mvc.perform(get("/api/applications").with(authentication(auth(first))).param("status", "PLANNED"))
                .andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.items[0].job.id").value(job));
        mvc.perform(get("/api/applications").with(authentication(auth(first))).param("page", "99"))
                .andExpect(jsonPath("$.items").isEmpty()).andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(get("/api/jobs").with(authentication(auth(first))).param("applicationStatus", "PLANNED").param("company", "S11"))
                .andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.items[0].applicationStatus").value("PLANNED"));
        mvc.perform(get("/api/jobs/" + job).with(authentication(auth(second))))
                .andExpect(jsonPath("$.applicationStatus").value("APPLIED"));
        mvc.perform(get("/api/jobs/" + otherJob).with(authentication(auth(second))))
                .andExpect(jsonPath("$.applicationStatus").isEmpty());
        mvc.perform(get("/api/jobs").with(authentication(auth(second))).param("applicationStatus", "PLANNED"))
                .andExpect(jsonPath("$.items").isEmpty());
    }
    @Test void bookmarkAndApplicationStateRemainIndependentOnTheSameJob() throws Exception {
        created("PLANNED", "");
        mvc.perform(post("/api/bookmarks").with(authentication(auth(first))).with(csrf())
                .contentType("application/json").content("{\"jobId\":" + job + "}"))
                .andExpect(status().isCreated());
        mvc.perform(get("/api/jobs").with(authentication(auth(first))).param("applicationStatus", "PLANNED"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(job))
                .andExpect(jsonPath("$.items[0].bookmarked").value(true))
                .andExpect(jsonPath("$.items[0].applicationStatus").value("PLANNED"));
        mvc.perform(get("/api/jobs/" + job).with(authentication(auth(first))))
                .andExpect(jsonPath("$.bookmarked").value(true))
                .andExpect(jsonPath("$.applicationStatus").value("PLANNED"));
        mvc.perform(get("/api/jobs/" + job).with(authentication(auth(second))))
                .andExpect(jsonPath("$.bookmarked").value(false))
                .andExpect(jsonPath("$.applicationStatus").isEmpty());
        mvc.perform(delete("/api/bookmarks/" + job).with(authentication(auth(first))).with(csrf()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/jobs/" + job).with(authentication(auth(first))))
                .andExpect(jsonPath("$.bookmarked").value(false))
                .andExpect(jsonPath("$.applicationStatus").value("PLANNED"));
    }
    @Test void badPagingAndStatusReturn400() throws Exception {
        for (String[] filter : new String[][]{{"page","-1"},{"size","0"},{"size","101"},{"status","unknown"},{"status",""},
                {"page","2147483647"}})
            mvc.perform(get("/api/applications").with(authentication(auth(first))).param(filter[0], filter[1]))
                    .andExpect(status().isBadRequest());
        mvc.perform(get("/api/jobs").with(authentication(auth(first))).param("applicationStatus", "unknown"))
                .andExpect(status().isBadRequest());
    }
}
