package com.devjob.resume;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.resume.service.ResumeRetention;
import com.devjob.user.entity.User;
import com.devjob.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.hamcrest.Matchers.*;

@Tag("database") @EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_b05_test")
@SpringBootTest(properties = "RESUME_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
@AutoConfigureMockMvc @Transactional @ExtendWith(OutputCaptureExtension.class)
class ResumeDatabaseTest {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired EntityManager entities;
    @Autowired ResumeRetention retention;
    User owner; User other;
    private static final String SECRET = "SECRET-RESUME-123";

    @BeforeEach void prepare() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_b05_test");
        owner = users.saveAndFlush(new User("b05-owner@example.com", "hash"));
        other = users.saveAndFlush(new User("b05-other@example.com", "hash"));
    }
    private RequestPostProcessor as(User user) {
        return authentication(new UsernamePasswordAuthenticationToken(new CurrentUser(user.getId(), user.getEmail()), null,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }
    private com.fasterxml.jackson.databind.JsonNode request(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder builder) throws Exception {
        return json.readTree(mvc.perform(builder).andExpect(status().is2xxSuccessful()).andReturn().getResponse().getContentAsString());
    }
    private long create(String content) throws Exception {
        return request(post("/api/me/resumes").with(as(owner)).with(csrf()).contentType("application/json")
                .content(json.writeValueAsString(java.util.Map.of("title", "기본 이력서", "content", content)))).get("id").asLong();
    }

    @Test void versionIdentityOwnershipAndReload() throws Exception {
        long id = create(SECRET);
        entities.clear();
        var initial = request(get("/api/me/resumes/" + id).with(as(owner)));
        long v1 = initial.get("latestVersionId").asLong();
        String v1At = initial.get("latestVersionCreatedAt").asText();
        assertThat(initial.has("content")).isFalse();
        assertThat(request(get("/api/me/resumes/" + id + "/versions/" + v1).with(as(owner))).get("content").asText())
                .isEqualTo(SECRET);
        var v2 = request(post("/api/me/resumes/" + id + "/versions").with(as(owner)).with(csrf())
                .contentType("application/json").content("{\"content\":\"두 번째 버전\"}"));
        assertThat(v2.get("id").asLong()).isNotEqualTo(v1);
        assertThat(v2.get("versionNumber").asInt()).isEqualTo(2);
        assertThat(v2.has("content")).isFalse();
        entities.clear();
        assertThat(request(get("/api/me/resumes/" + id + "/versions/" + v1).with(as(owner))).get("content").asText())
                .isEqualTo(SECRET);
        assertThat(request(get("/api/me/resumes/" + id + "/versions/" + v2.get("id").asLong()).with(as(owner)))
                .get("content").asText()).isEqualTo("두 번째 버전");
        var versionList = request(get("/api/me/resumes/" + id + "/versions").with(as(owner)));
        assertThat(versionList.size()).isEqualTo(2);
        assertThat(versionList.get(0).has("content")).isFalse();
        assertThat(request(get("/api/me/resumes").with(as(owner))).get("items").get(0).get("latestVersionId").asLong())
                .isEqualTo(v2.get("id").asLong());
        request(patch("/api/me/resumes/" + id).with(as(owner)).with(csrf()).contentType("application/json")
                .content("{\"title\":\"수정된 제목\"}"));
        entities.clear();
        assertThat(request(get("/api/me/resumes/" + id).with(as(owner))).get("title").asText())
                .isEqualTo("수정된 제목");
        assertThat(request(get("/api/me/resumes/" + id + "/versions/" + v1).with(as(owner))).get("createdAt").asText())
                .isEqualTo(v1At);
        byte[] stored = jdbc.queryForObject("select content_ciphertext from resume_version where id = ?", byte[].class, v1);
        assertThat(new String(stored, java.nio.charset.StandardCharsets.UTF_8)).doesNotContain(SECRET);
    }

    @Test void deniesOtherUserAndHidesDeletedContent() throws Exception {
        long id = create(SECRET);
        long versionId = request(get("/api/me/resumes/" + id).with(as(owner))).get("latestVersionId").asLong();
        mvc.perform(get("/api/me/resumes").with(as(other))).andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(get("/api/me/resumes/" + id).with(as(other))).andExpect(status().isForbidden());
        mvc.perform(get("/api/me/resumes/" + id + "/versions").with(as(other))).andExpect(status().isForbidden());
        mvc.perform(get("/api/me/resumes/" + id + "/versions/" + versionId).with(as(other)))
                .andExpect(status().isForbidden()).andExpect(content().string(not(containsString(SECRET))));
        mvc.perform(post("/api/me/resumes/" + id + "/versions").with(as(other)).with(csrf())
                .contentType("application/json").content("{\"content\":\"intrusion\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/me/resumes/" + id).with(as(other)).with(csrf())).andExpect(status().isForbidden());
        mvc.perform(delete("/api/me/resumes/" + id).with(as(owner)).with(csrf())).andExpect(status().isNoContent());
        entities.clear();
        mvc.perform(get("/api/me/resumes/" + id).with(as(owner))).andExpect(status().isNotFound());
        mvc.perform(get("/api/me/resumes/" + id + "/versions/" + versionId).with(as(owner))).andExpect(status().isNotFound());
        mvc.perform(get("/api/me/resumes").with(as(owner))).andExpect(jsonPath("$.items").isEmpty());
        assertThat(jdbc.queryForObject("select deleted_at is not null from resume where id=?", Boolean.class, id)).isTrue();
    }

    @Test void validatesInputsAndPurgesAfterThirtyDays() throws Exception {
        mvc.perform(get("/api/me/resumes")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/me/resumes").with(as(owner)).contentType("application/json")
                .content("{\"title\":\"x\",\"content\":\"x\"}")) .andExpect(status().isForbidden());
        for (String body : List.of("{}", "{\"title\":\"x\"}", "{\"title\":\"x\",\"content\":\"  \"}",
                "{\"title\":\"x\",\"content\":\"x\",\"unknown\":1}")) {
            mvc.perform(post("/api/me/resumes").with(as(owner)).with(csrf()).contentType("application/json")
                    .content(body)).andExpect(status().isBadRequest());
        }
        long id = create(SECRET);
        mvc.perform(patch("/api/me/resumes/" + id).with(as(owner)).with(csrf()).contentType("application/json")
                .content("{\"content\":\"changed\"}")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/me/resumes").with(as(owner)).param("size", "101")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/me/resumes/0").with(as(owner))).andExpect(status().isBadRequest());
        mvc.perform(get("/api/me/resumes/" + id + "/versions/9999999").with(as(owner)))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/me/resumes/" + id).with(as(owner)).with(csrf())).andExpect(status().isNoContent());
        long retainedId = create("29-day-retained");
        mvc.perform(delete("/api/me/resumes/" + retainedId).with(as(owner)).with(csrf())).andExpect(status().isNoContent());
        jdbc.update("update resume set deleted_at = ? where id = ?", java.sql.Timestamp.from(Instant.now().minusSeconds(31L * 86400)), id);
        jdbc.update("update resume set deleted_at = ? where id = ?", java.sql.Timestamp.from(Instant.now().minusSeconds(29L * 86400)), retainedId);
        entities.clear();
        retention.purgeExpired();
        entities.clear();
        assertThat(jdbc.queryForObject("select count(*) from resume where id=?", Integer.class, id)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from resume_version where resume_id=?", Integer.class, id)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from resume where id=?", Integer.class, retainedId)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from resume_version where resume_id=?", Integer.class, retainedId)).isEqualTo(1);
    }

    @Test void invalidSensitiveInputStaysOutOfErrorsAndApplicationLogs(CapturedOutput output) throws Exception {
        mvc.perform(post("/api/me/resumes").with(as(owner)).with(csrf()).contentType("application/json")
                .content("{\"title\":\"x\",\"content\":\"" + SECRET + "\",\"unknown\":true}"))
                .andExpect(status().isBadRequest()).andExpect(content().string(not(containsString(SECRET))));
        assertThat(output.getAll()).doesNotContain(SECRET);
    }
}
