package com.devjob.notification;

import com.devjob.auth.dto.CurrentUser;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Tag("database")
@EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_b13_test")
@SpringBootTest @AutoConfigureMockMvc
class NotificationDatabaseTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired NotificationService service;
    long owner, other;

    @BeforeEach void setup() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_b13_test");
        owner = user();
        other = user();
    }
    private long user() {
        return jdbc.queryForObject("insert into users(email,password_hash,created_at) values (?,?,current_timestamp) returning id",
                Long.class, UUID.randomUUID() + "@example.com", "hash");
    }
    private RequestPostProcessor as(long id) {
        return authentication(UsernamePasswordAuthenticationToken.authenticated(
                new CurrentUser(id, "test@example.com"), null, List.of()));
    }
    private long interview(Instant at) {
        return jdbc.queryForObject("insert into interview_schedule(user_id,title,starts_at,time_zone,created_at,updated_at) "
                + "values (?,?,?,'UTC',current_timestamp,current_timestamp) returning id",
                Long.class, owner, "Interview", Timestamp.from(at));
    }
    private long todo(Instant at) {
        return jdbc.queryForObject("insert into personal_todo(user_id,title,due_at,due_time_zone,created_at,updated_at) "
                + "values (?,?,?,'UTC',current_timestamp,current_timestamp) returning id",
                Long.class, owner, "Task", Timestamp.from(at));
    }

    @AfterEach void cleanup() {
        jdbc.update("delete from notification where user_id in (?,?)", owner, other);
        jdbc.update("delete from notification_preference where user_id in (?,?)", owner, other);
        jdbc.update("delete from interview_schedule where user_id in (?,?)", owner, other);
        jdbc.update("delete from personal_todo where user_id in (?,?)", owner, other);
        jdbc.update("delete from users where id in (?,?)", owner, other);
    }

    @Test void preferencesDeliveryDedupReadAndOwnership() throws Exception {
        Instant at = Instant.now().plusSeconds(3600);
        long interviewId = interview(at);
        todo(at);
        mvc.perform(get("/api/me/notification-preferences").with(as(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.interviewReminder").value(true))
                .andExpect(jsonPath("$.todoReminder").value(true));
        mvc.perform(put("/api/me/notification-preferences").with(as(owner)).with(csrf())
                .contentType("application/json")
                .content("{\"interviewReminder\":false,\"todoReminder\":true}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.interviewReminder").value(false));
        service.deliverDue();
        service.deliverDue();
        assertThat(jdbc.queryForObject("select count(*) from notification where user_id=?", Long.class, owner))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from notification where user_id=? and type='INTERVIEW_REMINDER'",
                Long.class, owner)).isZero();
        long notificationId = jdbc.queryForObject("select id from notification where user_id=?", Long.class, owner);
        mvc.perform(get("/api/me/notifications").with(as(other)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(patch("/api/me/notifications/" + notificationId + "/read").with(as(other)).with(csrf()))
                .andExpect(status().isNotFound());
        mvc.perform(patch("/api/me/notifications/" + notificationId + "/read").with(as(owner)).with(csrf()))
                .andExpect(status().isNoContent());
        Instant firstRead = jdbc.queryForObject("select read_at from notification where id=?",
                Timestamp.class, notificationId).toInstant();
        mvc.perform(patch("/api/me/notifications/" + notificationId + "/read").with(as(owner)).with(csrf()))
                .andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("select read_at from notification where id=?",
                Timestamp.class, notificationId).toInstant()).isEqualTo(firstRead);
        jdbc.update("update notification_preference set enabled=true where user_id=? and type='INTERVIEW_REMINDER'", owner);
        service.deliverDue();
        service.deliverDue();
        assertThat(jdbc.queryForObject("select count(*) from notification where user_id=?",
                Long.class, owner)).isEqualTo(2);
        jdbc.update("update interview_schedule set starts_at=? where id=?",
                Timestamp.from(at.plusSeconds(1800)), interviewId);
        service.deliverDue();
        assertThat(jdbc.queryForObject("select count(*) from notification where user_id=? and type='INTERVIEW_REMINDER'",
                Long.class, owner)).isEqualTo(2);
    }

    @Test void inactiveAndPastEventsAreSkipped() {
        Instant at = Instant.now().plusSeconds(3600);
        long cancelled = interview(at);
        long completed = todo(at);
        jdbc.update("update interview_schedule set cancelled_at=current_timestamp where id=?", cancelled);
        jdbc.update("update personal_todo set completed_at=current_timestamp where id=?", completed);
        interview(Instant.now().minusSeconds(1));
        todo(Instant.now().minusSeconds(1));
        service.deliverDue();
        assertThat(jdbc.queryForObject("select count(*) from notification where user_id=?", Long.class, owner)).isZero();
    }

    @Test void todoReminderRespectsSelectedLeadTimeAndDisabledValue() {
        long tenMinutes = todo(Instant.now().plusSeconds(3600));
        long disabled = todo(Instant.now().plusSeconds(300));
        jdbc.update("update personal_todo set reminder_minutes=10 where id=?", tenMinutes);
        jdbc.update("update personal_todo set reminder_minutes=-1 where id=?", disabled);
        service.deliverDue();
        assertThat(jdbc.queryForObject("select count(*) from notification where user_id=?", Long.class, owner)).isZero();
        jdbc.update("update personal_todo set due_at=? where id=?",
                Timestamp.from(Instant.now().plusSeconds(300)), tenMinutes);
        service.deliverDue();
        assertThat(jdbc.queryForObject("select count(*) from notification where user_id=? and type='TODO_REMINDER'",
                Long.class, owner)).isEqualTo(1);
    }
}
