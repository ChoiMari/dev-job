package com.devjob.auth;

import com.devjob.auth.dto.AccountDeletionRequest;
import com.devjob.auth.service.AccountDeletionService;
import com.devjob.auth.service.AuthService;
import com.devjob.auth.dto.Credentials;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Tag("database")
@EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_b15_test")
@SpringBootTest
@AutoConfigureMockMvc
class AccountDeletionDatabaseTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired AuthService auth;
    @Autowired AccountDeletionService deletion;

    private record Token(MockHttpSession session, String value) { }
    private record Fixture(long user, long other, long job, long company, long source, long skill, long application,
            long personalJob, long project, long resume, long cover, long resumeVersion, long coverVersion) { }

    @Test
    void impactMatchesEveryOwnedTableAndDeletionIsAtomicAndRevokesSessions() throws Exception {
        Fixture f = fixture();
        String email = email(f.user());
        MockHttpSession current = login(email);
        MockHttpSession old = login(email);
        MockHttpSession otherSession = login(email(f.other()));
        Token token = csrf(current);

        JsonNode impact = json.readTree(mvc.perform(get("/api/auth/me/deletion-impact").session(current))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(impact.path("deletedResources").size()).isEqualTo(34);
        assertThat(impact.path("recoverableInApp").asBoolean()).isFalse();
        assertThat(impact.path("confirmationText").asText()).isEqualTo("계정 삭제");
        for (JsonNode resource : impact.path("deletedResources")) {
            String code = resource.path("code").asText();
            if (!"cover_letter_draft".equals(code) && !"project_image".equals(code))
                assertThat(resource.path("count").asLong()).as(code).isPositive();
        }
        assertThat(impact.path("preservedSharedResources").size()).isEqualTo(3);

        mvc.perform(delete("/api/auth/me").session(current).contentType("application/json")
                .content(request("password123", "계정 삭제")))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
        mvc.perform(delete("/api/auth/me").session(current).header("X-CSRF-TOKEN", "invalid")
                .contentType("application/json").content(request("password123", "계정 삭제")))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/auth/me").session(current).header("X-CSRF-TOKEN", token.value())
                .contentType("application/json").content(request("wrong-password", "계정 삭제")))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/auth/me").session(current).header("X-CSRF-TOKEN", token.value())
                .contentType("application/json").content(request("password123", "잘못된 문구")))
                .andExpect(status().isBadRequest());
        for (String invalid : new String[]{"{}", "{", request("", "계정 삭제"),
                request("가".repeat(25), "계정 삭제")}) {
            mvc.perform(delete("/api/auth/me").session(current).header("X-CSRF-TOKEN", token.value())
                    .contentType("application/json").content(invalid))
                    .andExpect(status().isBadRequest());
        }
        assertThat(current.isInvalid()).isFalse();
        assertThat(jdbc.queryForObject("select count(*) from users where id=?", Long.class, f.user())).isEqualTo(1);

        String guard = "b15_guard_" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.execute("create table " + guard + " (user_id bigint references users(id))");
        try {
            jdbc.update("insert into " + guard + " (user_id) values (?)", f.user());
            mvc.perform(delete("/api/auth/me").session(current).header("X-CSRF-TOKEN", token.value())
                    .contentType("application/json").content(request("password123", "계정 삭제")))
                    .andExpect(status().isInternalServerError());
            assertThat(current.isInvalid()).isFalse();
            JsonNode afterFailure = json.readTree(mvc.perform(get("/api/auth/me/deletion-impact").session(current))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
            assertThat(afterFailure.path("deletedResources")).isEqualTo(impact.path("deletedResources"));
        } finally {
            jdbc.execute("drop table " + guard);
        }

        mvc.perform(delete("/api/auth/me").session(current).header("X-CSRF-TOKEN", token.value())
                .contentType("application/json").content(request("password123", "계정 삭제")))
                .andExpect(status().isNoContent()).andExpect(content().string(""))
                .andExpect(cookie().maxAge("JSESSIONID", 0));
        assertThat(current.isInvalid()).isTrue();
        mvc.perform(get("/api/auth/me").session(old)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/me/skills").session(old)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/auth/me").session(otherSession)).andExpect(status().isOk());
        Token after = csrf(null);
        mvc.perform(post("/api/auth/login").session(after.session()).header("X-CSRF-TOKEN", after.value())
                .contentType("application/json").content(credentials(email)))
                .andExpect(status().isUnauthorized());

        for (String table : new String[]{"profiles", "user_skill", "project", "bookmark",
                "application", "personal_saved_job", "personal_todo", "interested_company", "personal_company_tag", "resume_draft", "resume",
                "cover_letter", "interview_schedule", "learning_goal", "character_equipment",
                "character_activity", "character_reward", "notification_preference", "notification",
                "semantic_recommendation", "user_ai_skill_candidate", "user_ai_analysis_request", "user_custom_skill"}) {
            assertThat(count(table, "user_id", f.user())).as(table).isZero();
        }
        assertThat(count("users", "id", f.user())).isZero();
        assertThat(count("application_status_history", "application_id", f.application())).isZero();
        assertThat(count("personal_saved_job_analysis", "personal_saved_job_id", f.personalJob())).isZero();
        assertThat(count("project_skill", "project_id", f.project())).isZero();
        assertThat(count("project_custom_skill", "project_id", f.project())).isZero();
        assertThat(count("resume_version", "resume_id", f.resume())).isZero();
        assertThat(count("cover_letter_version", "cover_letter_id", f.cover())).isZero();
        assertThat(count("document_analysis", "resume_version_id", f.resumeVersion())).isZero();
        assertThat(count("document_analysis", "cover_letter_version_id", f.coverVersion())).isZero();
        assertThat(count("profiles", "user_id", f.other())).isEqualTo(1);
        assertThat(count("personal_todo", "user_id", f.other())).isEqualTo(1);
        assertThat(count("bookmark", "user_id", f.other())).isEqualTo(1);
        assertThat(count("application", "user_id", f.other())).isEqualTo(1);
        assertThat(count("job_posting", "id", f.job())).isEqualTo(1);
        assertThat(count("company", "id", f.company())).isEqualTo(1);
        assertThat(count("job_source", "id", f.source())).isEqualTo(1);
        assertThat(count("skill", "id", f.skill())).isEqualTo(1);
        assertThat(count("skill_alias", "skill_id", f.skill())).isPositive();
        long newUser = auth.register(new Credentials(email, "new-password123")).id();
        assertThat(newUser).isNotEqualTo(f.user());
        assertThat(count("profiles", "user_id", newUser)).isZero();
    }

    @Test
    void concurrentDeletionHasOneWinner() throws Exception {
        long user = auth.register(new Credentials("b15-race-" + UUID.randomUUID() + "@example.com", "password123")).id();
        var start = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(2);
        try {
            var first = pool.submit(() -> result(user, start));
            var second = pool.submit(() -> result(user, start));
            start.countDown();
            assertThat(new int[]{first.get(), second.get()}).containsExactlyInAnyOrder(204, 401);
            assertThat(count("users", "id", user)).isZero();
        } finally {
            pool.shutdownNow();
        }
    }

    private int result(long user, CountDownLatch start) throws Exception {
        start.await();
        try { deletion.delete(user, new AccountDeletionRequest("password123", "계정 삭제")); return 204; }
        catch (ResponseStatusException exception) { return exception.getStatusCode().value(); }
    }

    private Fixture fixture() {
        long user = auth.register(new Credentials("b15-" + UUID.randomUUID() + "@example.com", "password123")).id();
        long other = auth.register(new Credentials("b15-other-" + UUID.randomUUID() + "@example.com", "password123")).id();
        long skill = jdbc.queryForObject("select id from skill where normalized_name='java'", Long.class);
        long company = id("insert into company(name) values ('B15 fixture company') returning id");
        long source = id("insert into job_source(code,name) values (?,?) returning id",
                "B15_" + UUID.randomUUID().toString().replace("-", ""), "B15 fixture source");
        long job = id("insert into job_posting(job_source_id,external_id,company_id,title,source_url,created_at,updated_at) "
                + "values (?,?,?,?,?,now(),now()) returning id", source, "fixture", company, "B15 job", "https://example.com/job");
        jdbc.update("insert into profiles(user_id,name,updated_at) values (?,'Owner',now()),(?,'Other',now())", user, other);
        jdbc.update("insert into user_skill(user_id,skill_id,created_at) values (?,?,now())", user, skill);
        long project = id("insert into project(user_id,name,start_date,created_at,updated_at) "
                + "values (?,'Project',current_date,now(),now()) returning id", user);
        jdbc.update("insert into project_skill(project_id,skill_id) values (?,?)", project, skill);
        jdbc.update("insert into project_custom_skill(project_id,name,normalized_name) values (?,'Fixture Tool','fixture tool')", project);
        jdbc.update("insert into bookmark(user_id,job_posting_id) values (?,?)", user, job);
        jdbc.update("insert into bookmark(user_id,job_posting_id) values (?,?)", other, job);
        jdbc.update("insert into user_custom_skill(user_id,name,normalized_name) values (?,'Fixture','fixture')", user);
        jdbc.update("insert into user_ai_analysis_request(user_id,job_posting_id) values (?,?)", user, job);
        jdbc.update("insert into user_ai_skill_candidate(user_id,name,normalized_name) values (?,'Candidate','candidate')", user);
        jdbc.update("insert into application(user_id,job_posting_id,current_status,created_at,updated_at) "
                + "values (?,?,'PLANNED',now(),now())", other, job);
        long personalJob = id("insert into personal_saved_job(user_id,url,company_name,title,created_at,updated_at,deleted_at) "
                + "values (?,?,?,'Saved',now(),now(),now()) returning id", user, "https://example.com/manual", "Manual company");
        jdbc.update("insert into personal_saved_job_analysis(personal_saved_job_id,status,result_json,updated_at) "
                + "values (?,'COMPLETED','{}'::jsonb,now())", personalJob);
        long application = id("insert into application(user_id,personal_saved_job_id,current_status,created_at,updated_at) "
                + "values (?,?,'PLANNED',now(),now()) returning id", user, personalJob);
        jdbc.update("insert into application_status_history(application_id,to_status,changed_at) values (?,'PLANNED',now())", application);
        jdbc.update("insert into interview_schedule(user_id,application_id,title,starts_at,time_zone,created_at,updated_at) "
                + "values (?,?,'Interview',now(),'Asia/Seoul',now(),now())", user, application);
        long todo = id("insert into personal_todo(user_id,title,deleted_at,created_at,updated_at) "
                + "values (?,'Old todo',now(),now(),now()) returning id", user);
        jdbc.update("insert into personal_todo(user_id,title,created_at,updated_at) "
                + "values (?,'Other todo',now(),now())", other);
        long interestedCompany = id("insert into interested_company(user_id,name,status,interest_level,favorite,created_at,updated_at) "
                + "values (?,'Interested','INTERESTED','MEDIUM',false,now(),now()) returning id", user);
        jdbc.update("insert into interested_company_tag(company_id,position,tag) values (?,0,'직접태그')", interestedCompany);
        jdbc.update("insert into personal_company_tag(user_id,name) values (?,'직접태그')", user);
        long resume = id("insert into resume(user_id,title,deleted_at,created_at,updated_at) "
                + "values (?,'Resume',now(),now(),now()) returning id", user);
        jdbc.update("insert into resume_draft(user_id,content_ciphertext,content_nonce,updated_at) values (?,?,?,now())",
                user, new byte[]{3}, new byte[12]);
        long rv = id("insert into resume_version(resume_id,version_number,content_ciphertext,content_nonce,created_at) "
                + "values (?,1,?,?,now()) returning id", resume, new byte[]{1}, new byte[12]);
        long cover = id("insert into cover_letter(user_id,title,deleted_at,created_at,updated_at) "
                + "values (?,'Cover',now(),now(),now()) returning id", user);
        long cv = id("insert into cover_letter_version(cover_letter_id,version_number,content_ciphertext,content_nonce,created_at) "
                + "values (?,1,?,?,now()) returning id", cover, new byte[]{2}, new byte[12]);
        jdbc.update("insert into document_analysis(resume_version_id,status,consented_at,updated_at) "
                + "values (?,'PENDING',now(),now())", rv);
        jdbc.update("insert into document_analysis(cover_letter_version_id,status,consented_at,updated_at) "
                + "values (?,'PENDING',now(),now())", cv);
        jdbc.update("insert into semantic_recommendation(user_id,resume_version_id,cover_letter_version_id,input_hash,"
                + "policy_version,model_name,status,candidates,consented_at,updated_at) "
                + "values (?,?,?,?,? ,?,'PENDING','[]'::jsonb,now(),now())",
                user, rv, cv, UUID.randomUUID().toString().replace("-", "").repeat(2), "B14_V1", "test-model");
        jdbc.update("insert into learning_goal(user_id,skill_id,title,deleted_at,created_at,updated_at) "
                + "values (?,?,'Old goal',now(),now(),now())", user, skill);
        jdbc.update("insert into character_equipment(user_id,outfit_item_id,updated_at) values (?,'BASE',now())", user);
        jdbc.update("insert into character_activity(user_id,activity_type,activity_id,exp_amount,earned_at) "
                + "values (?,'TODO_COMPLETED',?,10,now())", user, todo);
        jdbc.update("insert into character_reward(user_id,quest_id,item_id,claimed_at) "
                + "values (?,'TODO_1','PEACH',now())", user);
        jdbc.update("insert into notification_preference(user_id,type,enabled) values (?,'TODO_REMINDER',true)", user);
        jdbc.update("insert into notification(user_id,type,source_id,scheduled_at,subject,created_at) "
                + "values (?,'TODO_REMINDER',?,now(),'Reminder',now())", user, todo);
        return new Fixture(user, other, job, company, source, skill, application,
                personalJob, project, resume, cover, rv, cv);
    }

    private long id(String sql, Object... arguments) { return jdbc.queryForObject(sql, Long.class, arguments); }
    private long count(String table, String column, long id) {
        return jdbc.queryForObject("select count(*) from " + table + " where " + column + "=?", Long.class, id);
    }
    private String email(long id) { return jdbc.queryForObject("select email from users where id=?", String.class, id); }
    private String credentials(String email) { return "{\"email\":\"" + email + "\",\"password\":\"password123\"}"; }
    private String request(String password, String confirmation) {
        return "{\"currentPassword\":\"" + password + "\",\"confirmation\":\"" + confirmation + "\"}";
    }
    private Token csrf(MockHttpSession session) throws Exception {
        var request = get("/api/auth/csrf");
        if (session != null) request.session(session);
        var result = mvc.perform(request).andExpect(status().isOk()).andReturn();
        return new Token((MockHttpSession) result.getRequest().getSession(),
                json.readTree(result.getResponse().getContentAsString()).path("token").asText());
    }
    private MockHttpSession login(String email) throws Exception {
        Token token = csrf(null);
        mvc.perform(post("/api/auth/login").session(token.session()).header("X-CSRF-TOKEN", token.value())
                .contentType("application/json").content(credentials(email))).andExpect(status().isOk());
        return token.session();
    }
}
