package com.devjob.company;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.job.entity.*;
import com.devjob.job.model.NormalizedJobPosting;
import com.devjob.job.repository.*;
import com.devjob.user.entity.User;
import com.devjob.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
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

@Tag("database") @EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_b04_test")
@SpringBootTest @AutoConfigureMockMvc @Transactional
class InterestedCompanyDatabaseTest {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired CompanyRepository publicCompanies;
    @Autowired JobSourceRepository sources;
    @Autowired JobPostingRepository postings;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    User owner; User other;

    @BeforeEach void prepare() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_b04_test");
        owner = users.saveAndFlush(new User("b04-owner@example.com", "hash"));
        other = users.saveAndFlush(new User("b04-other@example.com", "hash"));
    }
    private org.springframework.test.web.servlet.request.RequestPostProcessor as(User user) {
        return authentication(new UsernamePasswordAuthenticationToken(new CurrentUser(user.getId(), user.getEmail()), null,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }
    private String body(String name, String url, String status) {
        return "{\"name\":\"" + name + "\",\"websiteUrl\":" + (url == null ? "null" : "\"" + url + "\"")
                + ",\"note\":\" memo \",\"status\":\"" + status + "\"}";
    }
    private long create(User user, String name, String url) throws Exception {
        var response = mvc.perform(post("/api/me/companies").with(as(user)).with(csrf())
                .contentType("application/json").content(body(name, url, "INTERESTED")))
                .andExpect(status().isCreated()).andReturn();
        return json.readTree(response.getResponse().getContentAsString()).get("id").asLong();
    }
    @Test void sameNameCompaniesAndOwnersStaySeparateThroughCrud() throws Exception {
        long first = create(owner, "동명기업", null);
        long second = create(owner, "동명기업", null);
        long otherId = create(other, "동명기업", null);
        assertThat(first).isNotEqualTo(second).isNotEqualTo(otherId);
        mvc.perform(get("/api/me/companies").with(as(owner))).andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2)).andExpect(jsonPath("$.items.length()").value(2));
        mvc.perform(get("/api/me/companies/" + first).with(as(owner))).andExpect(jsonPath("$.name").value("동명기업"))
                .andExpect(jsonPath("$.note").value("memo"));
        mvc.perform(patch("/api/me/companies/" + first).with(as(owner)).with(csrf()).contentType("application/json")
                .content("{\"note\":null,\"status\":\"RESEARCHING\"}")).andExpect(status().isOk())
                .andExpect(jsonPath("$.note").isEmpty()).andExpect(jsonPath("$.status").value("RESEARCHING"));
        mvc.perform(get("/api/me/companies/" + first).with(as(owner))).andExpect(jsonPath("$.status").value("RESEARCHING"));
        mvc.perform(get("/api/me/companies/" + first).with(as(other))).andExpect(status().isForbidden());
        mvc.perform(patch("/api/me/companies/" + first).with(as(other)).with(csrf()).contentType("application/json")
                .content("{\"status\":\"ARCHIVED\"}")).andExpect(status().isForbidden());
        mvc.perform(delete("/api/me/companies/" + first).with(as(other)).with(csrf())).andExpect(status().isForbidden());
        mvc.perform(delete("/api/me/companies/" + first).with(as(owner)).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(get("/api/me/companies/" + first).with(as(owner))).andExpect(status().isNotFound());
        mvc.perform(get("/api/me/companies/" + second).with(as(owner))).andExpect(status().isOk());
        mvc.perform(get("/api/me/companies/" + otherId).with(as(other))).andExpect(status().isOk());
    }
    @Test void websiteIdentityIsPerUserAndRejectsDuplicateOnCreateAndPatch() throws Exception {
        long first = create(owner, "A", "HTTPS://EXAMPLE.COM:443/");
        mvc.perform(get("/api/me/companies/" + first).with(as(owner)))
                .andExpect(jsonPath("$.websiteUrl").value("https://example.com"));
        create(other, "B", "https://example.com");
        long second = create(owner, "C", "https://different.example.com");
        mvc.perform(patch("/api/me/companies/" + second).with(as(owner)).with(csrf()).contentType("application/json")
                .content("{\"websiteUrl\":\"https://example.com\"}")).andExpect(status().isConflict());
    }
    @Test void duplicateCreateReturnsConflict() throws Exception {
        create(owner, "A", "https://example.com");
        mvc.perform(post("/api/me/companies").with(as(owner)).with(csrf()).contentType("application/json")
                .content(body("B", "https://example.com/", "INTERESTED"))).andExpect(status().isConflict());
    }
    @Test void deletingPrivateRecordPreservesPublicJobAndCompany() throws Exception {
        var source = sources.save(new JobSource("B04_TEST", "Test"));
        var publicCompany = publicCompanies.save(new Company("동명기업"));
        var job = postings.saveAndFlush(new JobPosting(source, publicCompany, new NormalizedJobPosting(
                "b04-job", "동명기업", "개발자", "본문", null, null, null,
                LocalDate.parse("2026-10-01"), null, "https://example.com/jobs/b04")));
        long id = create(owner, "동명기업", null);
        mvc.perform(delete("/api/me/companies/" + id).with(as(owner)).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(get("/api/jobs/" + job.getId()).with(as(owner))).andExpect(status().isOk())
                .andExpect(jsonPath("$.company.id").value(publicCompany.getId()))
                .andExpect(jsonPath("$.company.name").value("동명기업"));
        assertThat(publicCompanies.findById(publicCompany.getId())).isPresent();
        assertThat(postings.findById(job.getId())).isPresent();
    }
    @Test void pagingAndInvalidValuesFollowCommonContract() throws Exception {
        create(owner, "First", null);
        create(owner, "Second", null);
        mvc.perform(get("/api/me/companies").with(as(owner)).param("size", "1"))
                .andExpect(jsonPath("$.totalElements").value(2)).andExpect(jsonPath("$.items.length()").value(1));
        mvc.perform(get("/api/me/companies").with(as(owner)).param("page", "10"))
                .andExpect(jsonPath("$.items").isEmpty()).andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(get("/api/me/companies").with(as(other))).andExpect(jsonPath("$.totalElements").value(0));
        for (String[] pair : new String[][]{{"page", "-1"}, {"size", "0"}, {"size", "101"}, {"page", "2147483647"}})
            mvc.perform(get("/api/me/companies").with(as(owner)).param(pair[0], pair[1])).andExpect(status().isBadRequest());
        for (String invalidUrl : List.of("ftp://example.com", "https://user:pass@example.com", "https://example.com/#x", "/relative"))
            mvc.perform(post("/api/me/companies").with(as(owner)).with(csrf()).contentType("application/json")
                    .content(body("Bad", invalidUrl, "INTERESTED"))).andExpect(status().isBadRequest());
        mvc.perform(get("/api/me/companies/0").with(as(owner))).andExpect(status().isBadRequest());
        mvc.perform(get("/api/me/companies/9223372036854775807").with(as(owner))).andExpect(status().isNotFound());
    }
}
