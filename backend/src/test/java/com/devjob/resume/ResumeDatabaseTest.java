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

    @Test void newVersionKeepsTitleDescriptionAndOriginalContent() throws Exception {
        long id = create(SECRET);
        long originalId = request(get("/api/me/resumes/" + id).with(as(owner))).get("latestVersionId").asLong();
        mvc.perform(post("/api/me/resumes/" + id + "/versions").with(as(owner)).with(csrf())
                .contentType("application/json").content("{\"title\":\" \",\"content\":\"새 원문\"}"))
                .andExpect(status().isBadRequest());
        var created = request(post("/api/me/resumes/" + id + "/versions").with(as(owner)).with(csrf())
                .contentType("application/json")
                .content("{\"title\":\"지원용 버전\",\"description\":\"프로젝트 경험 보강\",\"content\":\"새 원문\"}"));
        assertThat(created.get("title").asText()).isEqualTo("지원용 버전");
        assertThat(created.get("description").asText()).isEqualTo("프로젝트 경험 보강");
        assertThat(created.has("content")).isFalse();
        entities.clear();
        var versions = request(get("/api/me/resumes/" + id + "/versions").with(as(owner)));
        assertThat(versions.get(0).get("title").asText()).isEqualTo("지원용 버전");
        assertThat(versions.get(0).get("description").asText()).isEqualTo("프로젝트 경험 보강");
        assertThat(versions.get(1).has("title")).isFalse();
        assertThat(request(get("/api/me/resumes/" + id + "/versions/" + originalId).with(as(owner)))
                .get("content").asText()).isEqualTo(SECRET);
        assertThat(request(get("/api/me/resumes/" + id + "/versions/" + created.get("id").asLong()).with(as(owner)))
                .get("content").asText()).isEqualTo("새 원문");
    }

    @Test void rejectsEleventhVersionWithoutChangingExistingVersions() throws Exception {
        long id = create(SECRET);
        for (int number = 2; number <= 10; number++) {
            mvc.perform(post("/api/me/resumes/" + id + "/versions").with(as(owner)).with(csrf())
                    .contentType("application/json").content("{\"content\":\"버전 " + number + "\"}"))
                    .andExpect(status().isCreated());
        }
        mvc.perform(post("/api/me/resumes/" + id + "/versions").with(as(owner)).with(csrf())
                .contentType("application/json").content("{\"content\":\"초과 버전\"}"))
                .andExpect(status().isConflict());
        assertThat(request(get("/api/me/resumes/" + id + "/versions").with(as(owner)))).hasSize(10);
    }

    @Test void templateVersionEditResetsAnalysisAndDeleteKeepsLastVersion() throws Exception {
        String form = "{\"name\":\"홍길동\",\"phone\":\"\",\"email\":\"hong@example.com\",\"birth\":\"\","
                + "\"desiredRole\":\"백엔드 개발자\",\"location\":\"\",\"employment\":\"\",\"introduction\":\"\","
                + "\"education\":[],\"skills\":[],\"projects\":[],\"experience\":[],\"certificates\":[],\"training\":[],"
                + "\"link\":\"\",\"blog\":\"\",\"links\":[],\"extra\":\"\"}";
        var created = request(post("/api/me/resumes").with(as(owner)).with(csrf())
                .contentType("application/json").content("{\"title\":\"양식 이력서\",\"content\":\"이름: 홍길동\",\"form\":" + form + "}"));
        long resumeId = created.get("id").asLong();
        long firstId = created.get("latestVersionId").asLong();
        byte[] stored = jdbc.queryForObject("select form_ciphertext from resume_version where id=?", byte[].class, firstId);
        assertThat(new String(stored, java.nio.charset.StandardCharsets.UTF_8)).doesNotContain("hong@example.com");
        assertThat(request(get("/api/me/resumes/" + resumeId + "/versions/" + firstId).with(as(owner)))
                .get("form").get("name").asText()).isEqualTo("홍길동");
        jdbc.update("insert into document_analysis(resume_version_id,status,consented_at,updated_at) values (?,'FAILED',now(),now())", firstId);
        jdbc.update("insert into semantic_recommendation(user_id,resume_version_id,input_hash,policy_version,model_name,status,candidates,consented_at,updated_at) "
                + "values (?, ?, repeat('a',64), 'B14_V2', 'test', 'FAILED', '[]'::jsonb, now(), now())", owner.getId(), firstId);
        mvc.perform(patch("/api/me/resumes/" + resumeId + "/versions/" + firstId).with(as(owner)).with(csrf())
                .contentType("application/json")
                .content("{\"title\":\"수정본\",\"content\":\"수정된 원문\",\"form\":" + form + "}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("수정본"));
        assertThat(jdbc.queryForObject("select count(*) from document_analysis where resume_version_id=?", Long.class, firstId)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from semantic_recommendation where resume_version_id=?", Long.class, firstId)).isZero();
        assertThat(request(get("/api/me/resumes/" + resumeId + "/versions/" + firstId).with(as(owner)))
                .get("content").asText()).isEqualTo("수정된 원문");
        long secondId = request(post("/api/me/resumes/" + resumeId + "/versions").with(as(owner)).with(csrf())
                .contentType("application/json").content("{\"content\":\"다음 버전\"}")).get("id").asLong();
        mvc.perform(delete("/api/me/resumes/" + resumeId + "/versions/" + firstId).with(as(owner)).with(csrf()))
                .andExpect(status().isNoContent());
        assertThat(request(get("/api/me/resumes/" + resumeId).with(as(owner))).get("versionCount").asInt()).isEqualTo(1);
        mvc.perform(delete("/api/me/resumes/" + resumeId + "/versions/" + secondId).with(as(owner)).with(csrf()))
                .andExpect(status().isConflict());
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
    @Test void limitsActiveResumesToTwentyAndAllowsReplacementAfterDelete() throws Exception {
        long first = 0;
        for (int i = 0; i < 20; i++) {
            long id = create("이력서 본문 " + i);
            if (i == 0) first = id;
        }
        mvc.perform(post("/api/me/resumes").with(as(owner)).with(csrf()).contentType("application/json")
                .content("{\"title\":\"초과\",\"content\":\"본문\"}"))
                .andExpect(status().isConflict());
        mvc.perform(delete("/api/me/resumes/" + first).with(as(owner)).with(csrf())).andExpect(status().isNoContent());
        create("대체 이력서");
    }

    @Test void draftsAreEncryptedOwnedAndOnlySelectedOneIsClearedWhenResumeIsCreated() throws Exception {
        var form = json.createObjectNode();
        for (String field : List.of("name", "phone", "email", "birth", "desiredRole", "location", "employment",
                "introduction", "link", "extra")) form.put(field, "");
        form.put("blog", "https://blog.example.com");
        form.putArray("links").add("https://github.com/example");
        for (String field : List.of("education", "skills", "projects", "experience", "certificates")) form.putArray(field);
        form.putArray("training").addObject().put("name", "교육").put("provider", "기관")
                .put("start", "2026-01").put("end", "2026-02").put("content", "실습");
        var draft = json.createObjectNode().put("version", 1).put("mode", "template")
                .put("title", "").put("content", SECRET);
        draft.set("form", form);
        assertThat(request(get("/api/me/resumes/drafts").with(as(owner))).size()).isZero();
        long firstId = request(post("/api/me/resumes/drafts").with(as(owner)).with(csrf()).contentType("application/json")
                .content(json.writeValueAsString(draft))).get("id").asLong();
        long secondId = request(post("/api/me/resumes/drafts").with(as(owner)).with(csrf()).contentType("application/json")
                .content(json.writeValueAsString(draft))).get("id").asLong();
        assertThat(request(get("/api/me/resumes/drafts").with(as(owner))).size()).isEqualTo(2);
        assertThat(request(get("/api/me/resumes/drafts/" + firstId).with(as(owner))).get("content").asText()).isEqualTo(SECRET);
        assertThat(request(get("/api/me/resumes/drafts/" + firstId).with(as(owner))).at("/form/links/0").asText())
                .isEqualTo("https://github.com/example");
        mvc.perform(get("/api/me/resumes/drafts/" + firstId).with(as(other))).andExpect(status().isNotFound());
        for (int i = 2; i < 20; i++) request(post("/api/me/resumes/drafts").with(as(owner)).with(csrf())
                .contentType("application/json").content(json.writeValueAsString(draft)));
        mvc.perform(post("/api/me/resumes/drafts").with(as(owner)).with(csrf()).contentType("application/json")
                .content(json.writeValueAsString(draft))).andExpect(status().isConflict());
        assertThat(request(get("/api/me/resumes/drafts").with(as(owner))).size()).isEqualTo(20);
        var encrypted = jdbc.queryForObject("select content_ciphertext from resume_draft where id=?", byte[].class, firstId);
        assertThat(new String(encrypted, java.nio.charset.StandardCharsets.UTF_8)).doesNotContain(SECRET);
        mvc.perform(post("/api/me/resumes").with(as(owner)).with(csrf()).contentType("application/json")
                .content("{\"title\":\"최종 이력서\",\"content\":\"최종 원문\",\"draftId\":" + firstId + "}"))
                .andExpect(status().isCreated());
        mvc.perform(get("/api/me/resumes/drafts/" + firstId).with(as(owner))).andExpect(status().isNotFound());
        assertThat(request(get("/api/me/resumes/drafts/" + secondId).with(as(owner))).get("content").asText()).isEqualTo(SECRET);
    }

    @Test void versionDraftsResumeAcrossDevicesAndOnlyMatchingDraftIsConsumed() throws Exception {
        long resumeId = create("기본 원문");
        long firstVersionId = request(get("/api/me/resumes/" + resumeId).with(as(owner))).get("latestVersionId").asLong();
        var form = json.createObjectNode();
        for (String field : List.of("name", "phone", "email", "birth", "desiredRole", "location", "employment",
                "introduction", "link", "blog", "extra")) form.put(field, "");
        for (String field : List.of("education", "skills", "projects", "experience", "certificates", "training", "links"))
            form.putArray(field);
        var newDraft = json.createObjectNode().put("version", 2).put("mode", "free")
                .put("title", "새 버전").put("content", SECRET).put("purpose", "version-new")
                .put("resumeId", resumeId).put("description", "설명");
        newDraft.set("form", form);
        long newDraftId = request(post("/api/me/resumes/drafts").with(as(owner)).with(csrf())
                .contentType("application/json").content(json.writeValueAsString(newDraft))).get("id").asLong();
        assertThat(request(get("/api/me/resumes/drafts").with(as(owner))).get(0).get("purpose").asText())
                .isEqualTo("version-new");
        assertThat(request(get("/api/me/resumes/drafts/" + newDraftId).with(as(owner))).get("content").asText())
                .isEqualTo(SECRET);
        mvc.perform(get("/api/me/resumes/drafts/" + newDraftId).with(as(other))).andExpect(status().isNotFound());
        mvc.perform(post("/api/me/resumes").with(as(owner)).with(csrf()).contentType("application/json")
                .content("{\"title\":\"잘못된 사용\",\"content\":\"본문\",\"draftId\":" + newDraftId + "}"))
                .andExpect(status().isBadRequest());
        assertThat(request(get("/api/me/resumes/drafts/" + newDraftId).with(as(owner))).get("content").asText())
                .isEqualTo(SECRET);
        var added = request(post("/api/me/resumes/" + resumeId + "/versions").with(as(owner)).with(csrf())
                .contentType("application/json")
                .content("{\"content\":\"새 원문\",\"title\":\"새 버전\",\"draftId\":" + newDraftId + "}"));
        mvc.perform(get("/api/me/resumes/drafts/" + newDraftId).with(as(owner))).andExpect(status().isNotFound());
        assertThat(added.get("versionNumber").asInt()).isEqualTo(2);

        var editDraft = newDraft.deepCopy().put("purpose", "version-edit").put("versionId", firstVersionId)
                .put("title", "수정 중");
        long editDraftId = request(post("/api/me/resumes/drafts").with(as(owner)).with(csrf())
                .contentType("application/json").content(json.writeValueAsString(editDraft))).get("id").asLong();
        var unrelatedDraft = newDraft.deepCopy().put("content", "다른 초안");
        long unrelatedId = request(post("/api/me/resumes/drafts").with(as(owner)).with(csrf())
                .contentType("application/json").content(json.writeValueAsString(unrelatedDraft))).get("id").asLong();
        mvc.perform(patch("/api/me/resumes/" + resumeId + "/versions/" + added.get("id").asLong())
                .with(as(owner)).with(csrf()).contentType("application/json")
                .content("{\"content\":\"잘못된 대상\",\"draftId\":" + editDraftId + "}"))
                .andExpect(status().isBadRequest());
        request(patch("/api/me/resumes/" + resumeId + "/versions/" + firstVersionId)
                .with(as(owner)).with(csrf()).contentType("application/json")
                .content("{\"content\":\"수정 원문\",\"draftId\":" + editDraftId + "}"));
        mvc.perform(get("/api/me/resumes/drafts/" + editDraftId).with(as(owner))).andExpect(status().isNotFound());
        assertThat(request(get("/api/me/resumes/drafts/" + unrelatedId).with(as(owner))).get("content").asText())
                .isEqualTo("다른 초안");
    }
}
