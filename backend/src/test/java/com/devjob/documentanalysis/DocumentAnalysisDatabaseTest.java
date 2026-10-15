package com.devjob.documentanalysis;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.documentanalysis.adapter.DocumentAnalysisGateway;
import com.devjob.coverletter.service.CoverLetterRetention;
import com.devjob.user.entity.User;
import com.devjob.user.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Tag("database") @EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_b12_test")
@SpringBootTest(properties = "RESUME_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
@AutoConfigureMockMvc
class DocumentAnalysisDatabaseTest {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @MockitoBean DocumentAnalysisGateway gateway;
    @Autowired CoverLetterRetention coverRetention;

    private RequestPostProcessor as(User user) {
        return authentication(new UsernamePasswordAuthenticationToken(new CurrentUser(user.getId(), user.getEmail()), null,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }
    private JsonNode success(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request) throws Exception {
        return json.readTree(mvc.perform(request).andExpect(status().is2xxSuccessful()).andReturn().getResponse().getContentAsString());
    }
    private JsonNode create(User user, String base, String text) throws Exception {
        return success(post(base).with(as(user)).with(csrf()).contentType("application/json")
                .content(json.writeValueAsString(java.util.Map.of("title", "문서", "content", text))));
    }
    private JsonNode request(User user, String path) throws Exception {
        return success(post(path).with(as(user)).with(csrf()).contentType("application/json")
                .content("{\"consentToExternalAnalysis\":true}"));
    }
    private JsonNode awaitStatus(User user, String path, String expected) throws Exception {
        for (int i = 0; i < 100; i++) {
            var response = success(get(path).with(as(user)));
            if (expected.equals(response.get("status").asText())) return response;
            Thread.sleep(50);
        }
        throw new AssertionError("Analysis did not reach " + expected);
    }

    @Test void limitsActiveCoverLettersToTwenty() throws Exception {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_b12_test");
        User owner = users.saveAndFlush(new User("b12-limit-" + java.util.UUID.randomUUID() + "@example.com", "hash"));
        long first = 0;
        for (int i = 0; i < 20; i++) {
            long id = create(owner, "/api/me/cover-letters", "자기소개서 본문 " + i).path("id").asLong();
            if (i == 0) first = id;
        }
        mvc.perform(post("/api/me/cover-letters").with(as(owner)).with(csrf()).contentType("application/json")
                .content("{\"title\":\"초과\",\"content\":\"본문\"}"))
                .andExpect(status().isConflict());
        mvc.perform(delete("/api/me/cover-letters/" + first).with(as(owner)).with(csrf()))
                .andExpect(status().isNoContent());
        create(owner, "/api/me/cover-letters", "대체 자기소개서");
    }

    @Test void resumeOwnershipDeduplicationFailureRetryStalenessAndDeletion() throws Exception {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_b12_test");
        String run = java.util.UUID.randomUUID().toString();
        User owner = users.saveAndFlush(new User("b12-owner-" + run + "@example.com", "hash"));
        User other = users.saveAndFlush(new User("b12-other-" + run + "@example.com", "hash"));
        JsonNode resume = create(owner, "/api/me/resumes", "Java 개발 010-1234-5678 x@example.com");
        long id = resume.get("id").asLong(), version = resume.get("latestVersionId").asLong();
        String path = "/api/me/resumes/" + id + "/versions/" + version + "/analysis";
        when(gateway.available()).thenReturn(true);
        var entered = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        var calls = new AtomicInteger();
        when(gateway.analyze(anyString(), anyString())).thenAnswer(invocation -> {
            String sent = invocation.getArgument(1);
            assertThat(sent).doesNotContain("010-1234-5678", "x@example.com");
            if (calls.incrementAndGet() == 1) {
                entered.countDown();
                assertThat(release.await(5, TimeUnit.SECONDS)).isTrue();
                return "{\"skills\":[],\"strengths\":[],\"improvements\":[],\"score\":99}";
            }
            return "{\"skills\":[\" Java \"],\"strengths\":[\"개발 경험\"],\"improvements\":[\"성과를 구체화\"]}";
        });
        mvc.perform(post(path).with(as(owner)).with(csrf()).contentType("application/json")
                .content("{\"consentToExternalAnalysis\":false}")).andExpect(status().isBadRequest());
        mvc.perform(post(path).with(as(other)).with(csrf()).contentType("application/json")
                .content("{\"consentToExternalAnalysis\":true}")).andExpect(status().isForbidden());
        mvc.perform(get(path).with(as(other))).andExpect(status().isForbidden());
        mvc.perform(post("/api/me/resumes/" + id + "/versions/999999/analysis").with(as(owner)).with(csrf())
                .contentType("application/json").content("{\"consentToExternalAnalysis\":true}"))
                .andExpect(status().isNotFound());
        assertThat(request(owner, path).get("status").asText()).isEqualTo("PENDING");
        assertThat(entered.await(5, TimeUnit.SECONDS)).isTrue();
        assertThat(request(owner, path).get("status").asText()).isEqualTo("PENDING");
        assertThat(calls.get()).isEqualTo(1);
        release.countDown();
        assertThat(awaitStatus(owner, path, "FAILED").get("result").isNull()).isTrue();
        assertThat(success(get("/api/me/resumes/" + id).with(as(owner))).get("id").asLong()).isEqualTo(id);
        assertThat(request(owner, path).get("status").asText()).isEqualTo("PENDING");
        var done = awaitStatus(owner, path, "COMPLETED");
        assertThat(done.get("result").get("skills").get(0).asText()).isEqualTo("Java");
        assertThat(done.get("source").get("versionId").asLong()).isEqualTo(version);
        assertThat(done.get("source").get("createdAt").asText()).isEqualTo(resume.get("latestVersionCreatedAt").asText());
        byte[] encryptedResult = jdbc.queryForObject("select result_ciphertext from document_analysis where resume_version_id=?",
                byte[].class, version);
        assertThat(new String(encryptedResult, java.nio.charset.StandardCharsets.UTF_8)).doesNotContain("개발 경험");
        assertThat(done.get("stale").asBoolean()).isFalse();
        assertThat(request(owner, path).get("status").asText()).isEqualTo("COMPLETED");
        assertThat(calls.get()).isEqualTo(2);
        var v2 = success(post("/api/me/resumes/" + id + "/versions").with(as(owner)).with(csrf())
                .contentType("application/json").content("{\"content\":\"새 내용\"}"));
        assertThat(success(get(path).with(as(owner))).get("stale").asBoolean()).isTrue();
        mvc.perform(get("/api/me/resumes/" + id + "/versions/" + v2.get("id").asLong() + "/analysis")
                .with(as(owner))).andExpect(status().isNotFound());
        mvc.perform(delete(path).with(as(owner)).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(get(path).with(as(owner))).andExpect(status().isNotFound());
        request(owner, path);
        awaitStatus(owner, path, "COMPLETED");
        mvc.perform(delete("/api/me/resumes/" + id).with(as(owner)).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(get(path).with(as(owner))).andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("select count(*) from document_analysis where resume_version_id=?", Integer.class, version)).isZero();
        assertThat(success(get("/api/me/resumes").with(as(owner))).get("items").isEmpty()).isTrue();
    }

    @Test void coverLetterVersionIsEncryptedAndAnalysisIsDeletedWithDocument() throws Exception {
        User owner = users.saveAndFlush(new User("b12-cover-" + java.util.UUID.randomUUID() + "@example.com", "hash"));
        JsonNode cover = create(owner, "/api/me/cover-letters", "자기소개서 비밀 원문");
        long id = cover.get("id").asLong(), version = cover.get("latestVersionId").asLong();
        String path = "/api/me/cover-letters/" + id + "/versions/" + version + "/analysis";
        byte[] stored = jdbc.queryForObject("select content_ciphertext from cover_letter_version where id=?", byte[].class, version);
        assertThat(new String(stored, java.nio.charset.StandardCharsets.UTF_8)).doesNotContain("비밀 원문");
        when(gateway.available()).thenReturn(false);
        mvc.perform(post(path).with(as(owner)).with(csrf()).contentType("application/json")
                .content("{\"consentToExternalAnalysis\":true}")).andExpect(status().isServiceUnavailable());
        assertThat(success(get("/api/me/cover-letters/" + id).with(as(owner))).get("id").asLong()).isEqualTo(id);
        when(gateway.available()).thenReturn(true);
        when(gateway.analyze(anyString(), anyString())).thenReturn("{\"skills\":[],\"strengths\":[],\"improvements\":[]}");
        request(owner, path);
        awaitStatus(owner, path, "COMPLETED");
        mvc.perform(delete("/api/me/cover-letters/" + id).with(as(owner)).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(get(path).with(as(owner))).andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("select count(*) from document_analysis where cover_letter_version_id=?", Integer.class, version)).isZero();
        jdbc.update("update cover_letter set deleted_at=? where id=?",
                java.sql.Timestamp.from(java.time.Instant.now().minusSeconds(31L * 86400)), id);
        coverRetention.purgeExpired();
        assertThat(jdbc.queryForObject("select count(*) from cover_letter where id=?", Integer.class, id)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from cover_letter_version where id=?", Integer.class, version)).isZero();
    }
}
