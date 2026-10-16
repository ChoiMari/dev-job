package com.devjob.recommendation;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.user.entity.User;
import com.devjob.user.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Tag("database")
@EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_b14_test")
@SpringBootTest(properties = "RESUME_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
@AutoConfigureMockMvc
class RecommendationDatabaseTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired ObjectMapper json;
    @MockitoBean RecommendationGateway gateway;

    private RequestPostProcessor as(User user) {
        return authentication(new UsernamePasswordAuthenticationToken(new CurrentUser(user.getId(), user.getEmail()), null,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }
    private JsonNode response(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request) throws Exception {
        return json.readTree(mvc.perform(request).andExpect(status().is2xxSuccessful()).andReturn().getResponse().getContentAsString());
    }
    private JsonNode await(User user, long id, String expected) throws Exception {
        for (int i = 0; i < 100; i++) {
            JsonNode result = response(get("/api/me/recommendations/jobs").with(as(user)).param("requestId", Long.toString(id)));
            if (expected.equals(result.path("status").asText())) return result;
            Thread.sleep(50);
        }
        throw new AssertionError("Recommendation did not reach " + expected);
    }
    @Test void ownershipEvidenceCacheStaleDeletionAndExistingMatch() throws Exception {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_b14_test");
        String run = UUID.randomUUID().toString();
        User owner = users.saveAndFlush(new User("b14-owner-" + run + "@example.com", "hash"));
        User other = users.saveAndFlush(new User("b14-other-" + run + "@example.com", "hash"));
        JsonNode resume = response(post("/api/me/resumes").with(as(owner)).with(csrf()).contentType("application/json")
                .content("{\"title\":\"이력서\",\"content\":\"Java 서버 운영 경험\"}"));
        long version = resume.path("latestVersionId").asLong();
        long source = jdbc.queryForObject("insert into job_source(code,name) values (?, 'B14') returning id", Long.class,
                "B14_" + run.replace("-", "").toUpperCase());
        long company = jdbc.queryForObject("insert into company(name) values ('B14') returning id", Long.class);
        long job = jdbc.queryForObject("""
                insert into job_posting(job_source_id,company_id,external_id,title,description,location,deadline_date,source_url,created_at,updated_at)
                values (?,?,?,'백엔드 개발','Java 서비스 개발','서울','2099-12-31','https://example.com/b14',now(),now()) returning id
                """, Long.class, source, company, run);
        response(post("/api/applications").with(as(owner)).with(csrf()).contentType("application/json")
                .content("{\"jobId\":" + job + ",\"status\":\"APPLIED\",\"appliedDate\":\"2026-10-01\"}"));
        jdbc.update("insert into ai_analysis(job_posting_id,status,updated_at) values (?,'COMPLETED',now())", job);
        jdbc.update("insert into job_skill(job_posting_id,skill_id,requirement_type) "
                + "select ?,id,'REQUIRED' from skill where normalized_name='java'", job);
        long manual = jdbc.queryForObject("""
                insert into personal_saved_job(user_id,url,company_name,title,description,created_at,updated_at)
                values (?,'https://example.com/manual','B14','개인 공고',null,now(),now()) returning id
                """, Long.class, owner.getId());
        when(gateway.available()).thenReturn(true);
        when(gateway.compare(anyString())).thenReturn("""
                {"items":[{"kind":"COLLECTED","id":JOB,"rank":1,"evidence":[
                {"documentQuote":"Java 서버","jobQuote":"Java 서비스","explanation":"경험 관련성"}],
                "limitations":["공고에 경력 연수 없음"],
                "preparationTips":[{"type":"CHECK","basisQuote":"Java 서비스",
                  "text":"요구하는 서비스 운영 범위를 확인하세요."}]}]}
                """.replace("JOB", Long.toString(job)));
        String body = "{\"resumeVersionId\":" + version + ",\"coverLetterVersionId\":null,"
                + "\"candidates\":[{\"kind\":\"COLLECTED\",\"id\":" + job + "},"
                + "{\"kind\":\"MANUAL\",\"id\":" + manual + "}],"
                + "\"consentToExternalComparison\":true}";
        long id = response(post("/api/me/recommendations/jobs").with(as(owner)).with(csrf())
                .contentType("application/json").content(body)).path("id").asLong();
        JsonNode result = await(owner, id, "COMPLETED");
        assertThat(response(get("/api/me/recommendations/jobs/history").with(as(owner)))
                .path("items").get(0).path("id").asLong()).isEqualTo(id);
        assertThat(response(get("/api/me/recommendations/jobs/history").with(as(other)))
                .path("items").isEmpty()).isTrue();
        assertThat(result.path("candidateCount").asInt()).isEqualTo(2);
        assertThat(result.path("policyVersion").asText()).isEqualTo("B14_V3");
        assertThat(result.path("resumeVersionId").asLong()).isEqualTo(version);
        assertThat(jdbc.queryForObject("select model_name from semantic_recommendation where id=?", String.class, id))
                .isEqualTo("gpt-5.4-mini");
        assertThat(jdbc.queryForObject("select candidates::text from semantic_recommendation where id=?", String.class, id))
                .doesNotContain("Java 서비스 개발", "Java 서버 운영");
        assertThat(jdbc.queryForObject("select result_ciphertext from semantic_recommendation where id=?", byte[].class, id))
                .isNotEmpty();
        assertThat(jdbc.queryForObject("select count(*) from notification_outbox where type='SEMANTIC_RECOMMENDATION' and source_id=?",
                Integer.class, id)).isEqualTo(1);
        assertThat(result.path("items").get(0).path("rank").asInt()).isEqualTo(1);
        assertThat(result.path("items").get(0).path("status").asText()).isEqualTo("COMPLETED");
        assertThat(result.path("items").get(0).path("reason").isNull()).isTrue();
        assertThat(result.path("items").get(0).path("companyName").asText()).isEqualTo("B14");
        assertThat(result.path("items").get(0).path("location").asText()).isEqualTo("서울");
        assertThat(result.path("items").get(0).path("deadlineDate").asText()).isEqualTo("2099-12-31");
        assertThat(result.path("items").get(0).path("skillTags").get(0).asText()).isEqualTo("Java");
        assertThat(result.path("items").get(0).path("preparationTips").get(0).path("type").asText()).isEqualTo("CHECK");
        assertThat(result.path("items").get(1).path("status").asText()).isEqualTo("INSUFFICIENT_INPUT");
        assertThat(result.path("items").get(1).path("skillTags").isEmpty()).isTrue();
        assertThat(result.path("items").get(1).path("preparationTips").isEmpty()).isTrue();
        mvc.perform(get("/api/me/recommendations/jobs").with(as(other)).param("requestId", Long.toString(id)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/jobs/" + job + "/match").with(as(owner))).andExpect(status().isOk());
        mvc.perform(post("/api/me/recommendations/jobs").with(as(owner)).with(csrf())
                .contentType("application/json").content(body)).andExpect(status().isOk());
        verify(gateway, times(1)).compare(anyString());
        jdbc.update("update semantic_recommendation set policy_version='B14_V2' where id=?", id);
        mvc.perform(get("/api/me/recommendations/jobs").with(as(owner)).param("requestId", Long.toString(id)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.stale").value(true));
        String emptyBody = "{\"resumeVersionId\":" + version + ",\"coverLetterVersionId\":null,"
                + "\"candidates\":[],\"consentToExternalComparison\":true}";
        mvc.perform(post("/api/me/recommendations/jobs").with(as(owner)).with(csrf())
                .contentType("application/json").content(emptyBody)).andExpect(status().isBadRequest());
        verify(gateway, times(1)).compare(anyString());
        mvc.perform(post("/api/me/resumes/" + resume.path("id").asLong() + "/versions")
                .with(as(owner)).with(csrf()).contentType("application/json")
                .content("{\"content\":\"새로운 이력서 버전\"}"))
                .andExpect(status().isCreated());
        mvc.perform(get("/api/me/recommendations/jobs").with(as(owner)).param("requestId", Long.toString(id)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.stale").value(true));
        jdbc.update("update job_posting set updated_at=now()+interval '1 second' where id=?", job);
        mvc.perform(get("/api/me/recommendations/jobs").with(as(owner)).param("requestId", Long.toString(id)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.stale").value(true));
        mvc.perform(delete("/api/me/resumes/" + resume.path("id").asLong()).with(as(owner)).with(csrf()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/me/recommendations/jobs").with(as(owner)).param("requestId", Long.toString(id)))
                .andExpect(status().isNotFound());
    }

    @Test void providerFailureStaysWithinRecommendationAndExplicitRetryWorks() throws Exception {
        String run = UUID.randomUUID().toString();
        User owner = users.saveAndFlush(new User("b14-failure-" + run + "@example.com", "hash"));
        JsonNode cover = response(post("/api/me/cover-letters").with(as(owner)).with(csrf())
                .contentType("application/json")
                .content("{\"title\":\"자기소개서\",\"content\":\"Java 서버 운영 010-1234-5678\"}"));
        long manual = jdbc.queryForObject("""
                insert into personal_saved_job(user_id,url,company_name,title,description,created_at,updated_at)
                values (?,'https://example.com/failure','B14','개인 공고','Java 서비스 개발',now(),now()) returning id
                """, Long.class, owner.getId());
        jdbc.update("insert into personal_saved_job_analysis(personal_saved_job_id,status,result_json,analyzed_at,updated_at) "
                + "values (?,'COMPLETED','{\"requiredSkills\":[\"Java\"],\"preferredSkills\":[]}'::jsonb,now(),now())", manual);
        when(gateway.available()).thenReturn(true);
        when(gateway.compare(anyString())).thenThrow(new IllegalStateException("provider down"))
                .thenReturn("""
                {"items":[{"kind":"MANUAL","id":JOB,"rank":1,"evidence":[
                {"documentQuote":"Java 서버","jobQuote":"Java 서비스","explanation":"관련 경험"}],
                "limitations":["경력 기간 미상"],
                "preparationTips":[{"type":"IMPROVE","basisQuote":"Java 서버",
                  "text":"문서에 운영 경험을 구체적으로 표현할지 확인하세요."}]}]}
                """.replace("JOB", Long.toString(manual)));
        String body = "{\"resumeVersionId\":null,\"coverLetterVersionId\":" + cover.path("latestVersionId").asLong()
                + ",\"candidates\":[{\"kind\":\"MANUAL\",\"id\":" + manual
                + "}],\"consentToExternalComparison\":true}";
        long id = response(post("/api/me/recommendations/jobs").with(as(owner)).with(csrf())
                .contentType("application/json").content(body)).path("id").asLong();
        JsonNode failed = await(owner, id, "FAILED");
        assertThat(failed.path("failureReason").asText()).doesNotContain("provider down");
        mvc.perform(get("/api/me/saved-jobs/" + manual).with(as(owner))).andExpect(status().isOk());
        mvc.perform(post("/api/me/recommendations/jobs").with(as(owner)).with(csrf())
                .contentType("application/json").content(body)).andExpect(status().isAccepted());
        JsonNode completed = await(owner, id, "COMPLETED");
        assertThat(completed.path("items").get(0).path("rank").asInt()).isEqualTo(1);
        assertThat(completed.path("items").get(0).path("skillTags").get(0).asText()).isEqualTo("Java");
        verify(gateway, times(2)).compare(argThat(prompt -> !prompt.contains("010-1234-5678")));
        mvc.perform(delete("/api/me/saved-jobs/" + manual).with(as(owner)).with(csrf()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/me/recommendations/jobs").with(as(owner)).param("requestId", Long.toString(id)))
                .andExpect(status().isNotFound());
    }
}
