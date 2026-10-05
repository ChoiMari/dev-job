package com.devjob.bookmark;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.bookmark.dto.AddBookmarkRequest;
import com.devjob.bookmark.service.BookmarkService;
import com.devjob.job.entity.*;
import com.devjob.job.model.NormalizedJobPosting;
import com.devjob.job.repository.*;
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
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Tag("database") @EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_s10_test")
@SpringBootTest @AutoConfigureMockMvc @Transactional
class BookmarkDatabaseTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired BookmarkService service;
    @Autowired UserRepository users;
    @Autowired JobPostingRepository jobs;
    @Autowired JobSourceRepository sources;
    @Autowired CompanyRepository companies;
    User first, second;
    long jobId, otherJobId;
    @BeforeEach void seed() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_s10_test");
        first = users.saveAndFlush(new User("s10-first@example.com", "test-hash"));
        second = users.saveAndFlush(new User("s10-second@example.com", "test-hash"));
        var source = sources.save(new JobSource("S10_TEST", "Test"));
        var company = companies.save(new Company("S10 Company"));
        jobId = posting(source, company, "S10 Backend", null);
        otherJobId = posting(source, company, "S10 Frontend", LocalDate.of(2026, 10, 1));
    }
    private long posting(JobSource source, Company company, String title, LocalDate deadline) {
        return jobs.saveAndFlush(new JobPosting(source, company, new NormalizedJobPosting(title, company.getName(), title,
                null, null, null, null, null, deadline, "https://example.com/jobs/1"))).getId();
    }
    private org.springframework.test.web.servlet.request.RequestPostProcessor as(User user) {
        return authentication(new UsernamePasswordAuthenticationToken(new CurrentUser(user.getId(), user.getEmail()), null,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }
    private void add(User user, long id, int status) throws Exception {
        mvc.perform(post("/api/bookmarks").with(as(user)).with(csrf()).contentType("application/json")
                .content("{\"jobId\":" + id + ",\"userId\":" + second.getId() + "}"))
                .andExpect(status().is(status));
    }
    @Test void saveListReadDetailAndRemovePreserveJobAndIsolateOwners() throws Exception {
        mvc.perform(get("/api/bookmarks").with(as(first))).andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(post("/api/bookmarks").with(as(first)).with(csrf()).contentType("application/json")
                .content("{\"jobId\":" + jobId + "}")).andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber()).andExpect(jsonPath("$.job.id").value(jobId))
                .andExpect(jsonPath("$.job.bookmarked").value(true)).andExpect(jsonPath("$.createdAt").isString());
        add(first, jobId, 409);
        mvc.perform(get("/api/bookmarks").with(as(first)).param("userId", second.getId().toString()).header("X-User-Id", second.getId()))
                .andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.items[0].job.id").value(jobId));
        mvc.perform(get("/api/bookmarks").with(as(second))).andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(delete("/api/bookmarks/" + jobId).with(as(second)).with(csrf())
                .param("userId", first.getId().toString()).header("X-User-Id", first.getId())).andExpect(status().isNotFound());
        mvc.perform(get("/api/jobs/" + jobId).with(as(first))).andExpect(jsonPath("$.bookmarked").value(true));
        mvc.perform(get("/api/jobs/" + jobId).with(as(second))).andExpect(jsonPath("$.bookmarked").value(false));
        mvc.perform(get("/api/jobs").with(as(first)).param("q", "S10 Backend"))
                .andExpect(jsonPath("$.items[0].bookmarked").value(true));
        mvc.perform(get("/api/jobs").with(as(second)).param("q", "S10 Backend"))
                .andExpect(jsonPath("$.items[0].bookmarked").value(false));
        add(second, jobId, 201);
        mvc.perform(delete("/api/bookmarks/" + jobId).with(as(first)).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(get("/api/jobs/" + jobId).with(as(first))).andExpect(jsonPath("$.bookmarked").value(false));
        mvc.perform(get("/api/bookmarks").with(as(first))).andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(delete("/api/bookmarks/" + jobId).with(as(first)).with(csrf())).andExpect(status().isNotFound());
        assertThat(service.list(second.getId(), 0, 20).totalElements()).isEqualTo(1);
        assertThat(jobs.existsById(jobId)).isTrue();
    }
    @Test void paginationHasAccurateTotalsStableTieBreakAndKeepsExpiredAndUnknownDates() throws Exception {
        service.add(first.getId(), new AddBookmarkRequest(jobId));
        service.add(first.getId(), new AddBookmarkRequest(otherJobId));
        // PostgreSQL transaction timestamps tie; the ID must break ties consistently.
        mvc.perform(get("/api/bookmarks").with(as(first)).param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].job.id").value(otherJobId))
                .andExpect(jsonPath("$.totalElements").value(2)).andExpect(jsonPath("$.size").value(1));
        mvc.perform(get("/api/bookmarks").with(as(first)).param("size", "1").param("page", "1"))
                .andExpect(jsonPath("$.items[0].job.id").value(jobId));
        mvc.perform(get("/api/bookmarks").with(as(first)).param("page", "100"))
                .andExpect(jsonPath("$.items").isEmpty()).andExpect(jsonPath("$.totalElements").value(2));
    }
    @Test void invalidPagingIdsAndMissingJobsUseCommonErrors() throws Exception {
        for (String[] input : new String[][]{{"page", "-1"}, {"page", "abc"}, {"size", "0"}, {"size", "101"}, {"page", "2147483647"}})
            mvc.perform(get("/api/bookmarks").with(as(first)).param(input[0], input[1]))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        for (String id : new String[]{"0", "-1", "abc", "9223372036854775808"})
            mvc.perform(delete("/api/bookmarks/" + id).with(as(first)).with(csrf())).andExpect(status().isBadRequest());
        add(first, Long.MAX_VALUE, 404);
        assertThat(service.list(first.getId(), 0, 20).items()).isEmpty();
    }
    @Test void migrationRejectsMissingJobForeignKey() {
        assertThat(jdbc.queryForObject("select count(*) from flyway_schema_history where version='5' and success", Integer.class)).isEqualTo(1);
        assertThatThrownBy(() -> jdbc.update("insert into bookmark(user_id, job_posting_id) values (?, ?)", first.getId(), Long.MAX_VALUE))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }
    @Test void migrationRejectsMissingUserForeignKey() {
        assertThatThrownBy(() -> jdbc.update("insert into bookmark(user_id, job_posting_id) values (?, ?)", Long.MAX_VALUE, jobId))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }
    @Test void migrationRejectsDuplicateUserJobEvenWithoutService() {
        service.add(first.getId(), new AddBookmarkRequest(jobId));
        assertThatThrownBy(() -> jdbc.update("insert into bookmark(user_id, job_posting_id) values (?, ?)", first.getId(), jobId))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }
}
