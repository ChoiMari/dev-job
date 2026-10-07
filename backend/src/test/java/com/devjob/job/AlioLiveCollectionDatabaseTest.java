package com.devjob.job;

import com.devjob.job.adapter.JobSearchCondition;
import com.devjob.job.adapter.alio.AlioAdapter;
import com.devjob.job.service.JobCollectionResult;
import com.devjob.job.service.JobCollectionService;
import com.devjob.auth.dto.CurrentUser;
import com.devjob.user.entity.User;
import com.devjob.user.repository.UserRepository;
import java.util.List;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Explicit live smoke test against the disposable database; provider payloads and key are never printed. */
@Tag("database")
@EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_personal_test")
@EnabledIfEnvironmentVariable(named = "ALIO_LIVE_TEST", matches = "true")
@SpringBootTest
@AutoConfigureMockMvc
class AlioLiveCollectionDatabaseTest {
    @Autowired AlioAdapter adapter;
    @Autowired JobCollectionService collection;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Test void threeProviderPagesPersistAndSearchDeveloperRoles() throws Exception {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_personal_test");
        var result = collection.collect(adapter, new JobSearchCondition(null, 0, 20, 3));
        assertThat(result.status()).isIn(JobCollectionResult.Status.COMPLETED, JobCollectionResult.Status.PARTIAL_FAILURE);
        assertThat(jdbc.queryForObject("select count(*) from job_posting", Long.class)).isPositive();
        assertThat(jdbc.queryForObject("select count(*) from job_posting where title like '%개발%'", Long.class)).isPositive();
        var user = users.findByEmail("alio-live-search@example.com")
                .orElseGet(() -> users.saveAndFlush(new User("alio-live-search@example.com", "hash")));
        var auth = UsernamePasswordAuthenticationToken.authenticated(new CurrentUser(user.getId(), user.getEmail()), null, List.of());
        mvc.perform(get("/api/jobs").with(authentication(auth)).param("q", "개발").param("itOnly", "true")
                .param("role", "DEVELOPMENT").param("page", "0").param("size", "20"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(org.hamcrest.Matchers.greaterThan(0)))
                .andExpect(jsonPath("$.items[0].role").value("DEVELOPMENT"));
        mvc.perform(get("/api/jobs").with(authentication(auth)).param("q", "존재하지않는공고"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
    }
}
