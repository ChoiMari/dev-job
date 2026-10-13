package com.devjob.analysis;

import com.devjob.analysis.dto.MarketAnalyticsQuery;
import com.devjob.analysis.dto.SkillDemandQuery;
import com.devjob.analysis.dto.SkillTrendQuery;
import com.devjob.analysis.service.MarketAnalyticsService;
import com.devjob.analysis.service.SkillDemandService;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
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
@EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_b08_test")
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class MarketAnalyticsDatabaseTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired MarketAnalyticsService service;
    @Autowired SkillDemandService existingDemand;
    @Autowired MockMvc mvc;

    @Test void distributionsIncludeUnknownAndCountEachSourceIdentityOnce() {
        Fixture f = fixture();
        var all = service.careers(new MarketAnalyticsQuery(null, null, null, f.prefix));
        assertThat(all.jobCount()).isEqualTo(5);
        assertThat(all.insufficientSample()).isTrue();
        Map<String, Long> careers = all.buckets().stream().collect(Collectors.toMap(b -> b.key(), b -> b.jobCount()));
        assertThat(careers).containsEntry("ENTRY", 2L).containsEntry("JUNIOR", 1L)
                .containsEntry("UNCLASSIFIED", 2L);
        assertThat(all.buckets()).allSatisfy(b -> assertThat(b.ratio()).isEqualTo(b.jobCount() / 5.0));
        assertThat(all.buckets().stream().mapToLong(b -> b.jobCount()).sum()).isEqualTo(all.jobCount());
        assertThat(all.buckets().stream().mapToDouble(b -> b.ratio()).sum()).isEqualTo(1.0);

        var locations = service.locations(new MarketAnalyticsQuery(null, null, null, f.prefix));
        Map<String, Long> regions = locations.buckets().stream().collect(Collectors.toMap(b -> b.key(), b -> b.jobCount()));
        assertThat(regions).containsEntry("SEOUL", 2L).containsEntry("BUSAN", 1L)
                .containsEntry("NATIONWIDE_REMOTE", 1L).containsEntry("UNKNOWN", 1L);
        var bounded = service.careers(new MarketAnalyticsQuery("2026-10-01", "2026-10-02", f.sourceCode, f.prefix));
        assertThat(bounded.jobCount()).isEqualTo(2); // both boundary dates; null date and other source excluded
        assertThat(service.locations(new MarketAnalyticsQuery("2026-09-01", "2026-09-30", null, f.prefix)).jobCount()).isZero();
    }

    @Test void trendUsesCompletedAnalysisAndFillsEmptyPeriodsWithoutChangingExistingDemand() {
        Fixture f = fixture();
        var trend = service.trends(new SkillTrendQuery("2026-10-01", "2026-12-31", null, f.prefix,
                f.javaSkill, SkillTrendQuery.Interval.MONTH));
        assertThat(trend.periods()).hasSize(3);
        assertThat(trend.periods().get(0).analyzedJobCount()).isEqualTo(3);
        assertThat(trend.periods().get(0).jobCount()).isEqualTo(2);
        assertThat(trend.periods().get(0).ratio()).isEqualTo(0.6667);
        assertThat(trend.periods().get(0).insufficientSample()).isTrue();
        assertThat(trend.periods().get(1).analyzedJobCount()).isZero();
        assertThat(trend.periods().get(1).jobCount()).isZero();
        assertThat(trend.periods().get(1).ratio()).isNull();
        assertThat(trend.periods().get(2).analyzedJobCount()).isZero();
        var week = service.trends(new SkillTrendQuery("2026-10-01", "2026-10-04", null, f.prefix,
                f.javaSkill, SkillTrendQuery.Interval.WEEK));
        assertThat(week.periods()).hasSize(1);
        assertThat(week.periods().get(0).periodStart()).hasToString("2026-09-28");
        assertThat(week.periods().get(0).jobCount()).isEqualTo(2);

        var previous = existingDemand.find(new SkillDemandQuery("2026-10-01", "2026-10-04", f.prefix, 0, 20));
        assertThat(previous.analyzedJobCount()).isEqualTo(3);
        var javaDemand = previous.items().stream().filter(item -> item.skill().id().equals(f.javaSkill)).findFirst();
        assertThat(javaDemand).isPresent();
        assertThat(javaDemand.orElseThrow().jobCount()).isEqualTo(2);
        assertThat(javaDemand.orElseThrow().ratio()).isCloseTo(2.0 / 3, within(0.00001));
    }

    @Test void endpointsRequireSessionAndValidateInput() throws Exception {
        mvc.perform(get("/api/analytics/career-levels")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/analytics/locations").with(user("b08"))
                .param("dateFrom", "2026-10-03").param("dateTo", "2026-10-02"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/analytics/skills/trends").with(user("b08"))
                .param("dateFrom", "2026-10-01").param("dateTo", "2026-10-31")
                .param("skillId", "0"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/analytics/skills/trends").with(user("b08"))
                .param("dateFrom", "2020-01-01").param("dateTo", "2026-01-01")
                .param("skillId", "1"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/analytics/career-levels").with(user("b08"))
                .param("source", "NO_SUCH_B08_SOURCE"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.jobCount").value(0))
                .andExpect(jsonPath("$.buckets.length()").value(0));
        mvc.perform(get("/api/analytics/skills/trends").with(user("b08"))
                .param("dateFrom", "2026-10-01").param("dateTo", "2026-10-31")
                .param("skillId", "1").param("source", "NO_SUCH_B08_SOURCE"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.periods[0].analyzedJobCount").value(0))
                .andExpect(jsonPath("$.periods[0].ratio").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test void insufficientSampleThresholdChangesAtTen() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_b08_test");
        String prefix = "B08_THRESHOLD_" + UUID.randomUUID();
        long source = jdbc.queryForObject("insert into job_source (code, name) values (?, 'B08 threshold') returning id", Long.class,
                "B08_" + UUID.randomUUID().toString().replace("-", "").toUpperCase());
        long company = jdbc.queryForObject("insert into company (name) values (?) returning id", Long.class, prefix);
        for (int i = 0; i < 9; i++) job(source, company, String.valueOf(i), prefix, "2026-10-01", "신입", "서울");
        var query = new MarketAnalyticsQuery(null, null, null, prefix);
        assertThat(service.careers(query).jobCount()).isEqualTo(9);
        assertThat(service.careers(query).insufficientSample()).isTrue();
        job(source, company, "9", prefix, "2026-10-01", "신입", "서울");
        assertThat(service.careers(query).jobCount()).isEqualTo(10);
        assertThat(service.careers(query).insufficientSample()).isFalse();
    }

    private Fixture fixture() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_b08_test");
        String prefix = "B08_" + UUID.randomUUID();
        String sourceCode = "B08_" + UUID.randomUUID().toString().replace("-", "").toUpperCase();
        long firstSource = jdbc.queryForObject("insert into job_source (code, name) values (?, 'B08') returning id", Long.class, sourceCode);
        long secondSource = jdbc.queryForObject("insert into job_source (code, name) values (?, 'B11 fixture') returning id", Long.class,
                "B11_" + UUID.randomUUID().toString().replace("-", "").toUpperCase());
        long company = jdbc.queryForObject("insert into company (name) values (?) returning id", Long.class, prefix);
        long java = jdbc.queryForObject("select id from skill where name = 'Java'", Long.class);
        long a = job(firstSource, company, "same", prefix, "2026-10-01", "신입", "서울");
        assertThat(jdbc.update("insert into job_posting (job_source_id, company_id, external_id, title, source_url, created_at, updated_at) "
                + "values (?, ?, 'same', ?, 'https://example.com', now(), now()) "
                + "on conflict (job_source_id, external_id) do nothing", firstSource, company, prefix)).isZero();
        long b = job(firstSource, company, "2", prefix, "2026-10-02", "경력 3년", "부산");
        long c = job(secondSource, company, "same", prefix, "2026-10-04", "신입", "서울");
        long d = job(firstSource, company, "4", prefix, null, null, null);
        long e = job(firstSource, company, "5", prefix, "2026-10-03", "경력 무관", "전국/원격");
        analysis(a, "COMPLETED"); analysis(b, "COMPLETED"); analysis(c, "COMPLETED");
        analysis(d, "COMPLETED"); analysis(e, "PENDING");
        skill(a, java, "REQUIRED"); skill(c, java, "PREFERRED"); skill(e, java, "REQUIRED");
        return new Fixture(prefix, sourceCode, java);
    }

    private long job(long source, long company, String external, String title, String posted, String career, String location) {
        return jdbc.queryForObject("insert into job_posting (job_source_id, company_id, external_id, title, posted_date, career_requirement, location, source_url, created_at, updated_at) "
                + "values (?, ?, ?, ?, ?::date, ?, ?, 'https://example.com', now(), now()) returning id", Long.class,
                source, company, external, title, posted, career, location);
    }
    private void analysis(long job, String status) {
        jdbc.update("insert into ai_analysis (job_posting_id, status, updated_at) values (?, ?, now())", job, status);
    }
    private void skill(long job, long id, String type) {
        jdbc.update("insert into job_skill (job_posting_id, skill_id, requirement_type) values (?, ?, ?)", job, id, type);
    }
    private record Fixture(String prefix, String sourceCode, Long javaSkill) { }
}
