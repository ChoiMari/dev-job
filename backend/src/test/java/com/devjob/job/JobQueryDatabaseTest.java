package com.devjob.job;

import com.devjob.job.entity.*;
import com.devjob.job.model.NormalizedJobPosting;
import com.devjob.job.repository.*;
import com.devjob.auth.dto.CurrentUser;
import com.devjob.user.entity.User;
import com.devjob.user.repository.UserRepository;
import java.time.LocalDate;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Tag("database")
@EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_s08_test|devjob_s10_test|devjob_s11_test|devjob_s13_test")
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class JobQueryDatabaseTest {
    @Autowired MockMvc mvc;
    @Autowired JobPostingRepository jobs;
    @Autowired CompanyRepository companies;
    @Autowired JobSourceRepository sources;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    org.springframework.security.authentication.UsernamePasswordAuthenticationToken principal;
    long first, second, unknown;

    @BeforeEach void seed() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isIn("devjob_s08_test", "devjob_s10_test", "devjob_s11_test", "devjob_s13_test");
        var owner = users.saveAndFlush(new User("s08-query@example.com", "hash"));
        principal = org.springframework.security.authentication.UsernamePasswordAuthenticationToken.authenticated(
                new CurrentUser(owner.getId(), owner.getEmail()), null, java.util.List.of());
        // Transaction rollback isolates each test without resetting any database.
        var source = sources.save(new JobSource("S08_TEST", "Test"));
        first = posting(source, "Alpha", "Backend Engineer", "서울 강남", "신입", "정규직", "2026-10-01", "2026-11-01", "Java\n<script>alert(1)</script>");
        second = posting(source, "Beta", "Frontend Engineer", "부산", "경력", "계약직", "2026-10-02", "2026-10-10", "body");
        unknown = posting(source, "100%_Company", "Unknown dates", null, null, null, null, null, null);
        jobs.flush();
    }
    private long posting(JobSource source, String company, String title, String location, String career,
            String employment, String posted, String deadline, String body) {
        return jobs.save(new JobPosting(source, companies.save(new Company(company)), new NormalizedJobPosting(
                title, company, title, body, employment, career, location,
                posted == null ? null : LocalDate.parse(posted), deadline == null ? null : LocalDate.parse(deadline),
                "https://example.com/jobs/1"))).getId();
    }

    @Test void keywordSearchesCompanyAndTitleCaseInsensitivelyAndEscapesWildcards() throws Exception {
        for (String q : new String[]{" backend ", "aLpHa"}) mvc.perform(get("/api/jobs").with(authentication(principal)).param("q", q))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.items[0].id").value(first));
        mvc.perform(get("/api/jobs").with(authentication(principal)).param("q", "%_"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(unknown)).andExpect(jsonPath("$.totalElements").value(1));
    }
    @Test void pagingOrdersDatesWithNullLastAndHasAccurateTotals() throws Exception {
        mvc.perform(get("/api/jobs").with(authentication(principal)).param("size", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(second)).andExpect(jsonPath("$.totalElements").value(3));
        mvc.perform(get("/api/jobs").with(authentication(principal)).param("size", "1").param("page", "1"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(first)).andExpect(jsonPath("$.page").value(1));
        mvc.perform(get("/api/jobs").with(authentication(principal)).param("sort", "deadline"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(second)).andExpect(jsonPath("$.items[2].id").value(unknown));
        mvc.perform(get("/api/jobs").with(authentication(principal)).param("page", "20"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty()).andExpect(jsonPath("$.totalElements").value(3));
    }
    @Test void basicFiltersCombineAndEachMatchesStoredFields() throws Exception {
        String[][] filters = {{"company", "alph"}, {"location", "서울"}, {"careerLevel", "신입"}, {"employmentType", "정규직"}};
        var combined = get("/api/jobs").with(authentication(principal));
        for (var filter : filters) {
            mvc.perform(get("/api/jobs").with(authentication(principal)).param(filter[0], filter[1]))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(first)).andExpect(jsonPath("$.totalElements").value(1));
            combined.param(filter[0], filter[1]);
        }
        mvc.perform(combined.param("deadlineBefore", "2026-11-01"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/jobs").with(authentication(principal)).param("deadlineBefore", "2026-10-10"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(second)).andExpect(jsonPath("$.totalElements").value(1));
    }
    @Test void itOnlyFiltersBeforePagingInRegularAndMatchRateSearch() throws Exception {
        for (String sort : new String[]{"latest", "matchRate"}) {
            mvc.perform(get("/api/jobs").with(authentication(principal)).param("itOnly", "true")
                    .param("sort", sort).param("size", "1"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(2));
            mvc.perform(get("/api/jobs").with(authentication(principal)).param("itOnly", "true")
                    .param("sort", sort).param("size", "1").param("page", "2"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
        }
    }
    @Test void sourceFiltersStoredJobsBeforePagingInBothSearchPaths() throws Exception {
        var alio = sources.save(new JobSource("ALIO_RECRUITMENT", "공공기관 채용"));
        long alioJob = posting(alio, "Public", "보안 개발자", "서울", "신입", "정규직", "2026-10-03", "2026-11-03", "body");
        jobs.flush();
        for (String sort : new String[]{"latest", "matchRate"}) {
            mvc.perform(get("/api/jobs").with(authentication(principal)).param("source", "ALIO_RECRUITMENT")
                    .param("itOnly", "true").param("sort", sort).param("size", "1"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                    .andExpect(jsonPath("$.items[0].id").value(alioJob))
                    .andExpect(jsonPath("$.items[0].source").value("ALIO_RECRUITMENT"));
            mvc.perform(get("/api/jobs").with(authentication(principal)).param("source", "ALIO_RECRUITMENT")
                    .param("sort", sort).param("size", "1").param("page", "1"))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                    .andExpect(jsonPath("$.items").isEmpty());
        }
        mvc.perform(get("/api/jobs").with(authentication(principal)).param("source", "WORK24_OPEN_RECRUITMENT"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
    }
    @Test void emptyResultsAndNoAnalysisDetailKeepOriginalContent() throws Exception {
        mvc.perform(get("/api/jobs").with(authentication(principal)).param("q", "no-such-job"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/jobs/" + first).with(authentication(principal)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(first)).andExpect(jsonPath("$.company.name").value("Alpha"))
                .andExpect(jsonPath("$.description").value("Java\n<script>alert(1)</script>"))
                .andExpect(jsonPath("$.source").value("S08_TEST")).andExpect(jsonPath("$.requiredSkills").isEmpty())
                .andExpect(jsonPath("$.analysis").isEmpty()).andExpect(jsonPath("$.matchRate").isEmpty())
                .andExpect(jsonPath("$.sourceUrl").value("https://example.com/jobs/1"));
        mvc.perform(get("/api/jobs/" + unknown).with(authentication(principal))).andExpect(status().isOk()).andExpect(jsonPath("$.description").isEmpty());
        mvc.perform(get("/api/jobs/9223372036854775807").with(authentication(principal)))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }
    @Test void invalidFiltersDatesAndIdsReturn400() throws Exception {
        String[][] invalid = {{"page", "-1"}, {"page", "abc"}, {"size", "0"}, {"size", "101"}, {"sort", "other"},
                {"deadlineBefore", "2026-02-30"}, {"q", "x".repeat(201)},
                {"skillId", "0"}, {"minMatchRate", "101"}, {"applicationStatus", "UNKNOWN"}, {"source", "bad-source"}};
        for (var filter : invalid) mvc.perform(get("/api/jobs").with(authentication(principal)).param(filter[0], filter[1]))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        for (String id : new String[]{"0", "-1", "invalid", "9223372036854775808"})
            mvc.perform(get("/api/jobs/" + id).with(authentication(principal))).andExpect(status().isBadRequest());
    }
    @Test void anonymousListAndDetailUseExistingSessionContract() throws Exception {
        mvc.perform(get("/api/jobs")).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        mvc.perform(get("/api/jobs/" + first)).andExpect(status().isUnauthorized());
    }
    @Test void equalDatesHaveStableIdTieBreak() throws Exception {
        var source = sources.findByCode("S08_TEST").orElseThrow();
        long tied = posting(source, "Gamma", "Tied", "서울", null, null, "2026-10-02", "2026-10-10", null);
        mvc.perform(get("/api/jobs").with(authentication(principal)).param("sort", "deadline"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(tied)).andExpect(jsonPath("$.items[1].id").value(second));
    }
}
