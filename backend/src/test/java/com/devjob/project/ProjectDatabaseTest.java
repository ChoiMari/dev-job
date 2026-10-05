package com.devjob.project;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.user.entity.User;
import com.devjob.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
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

@Tag("database") @EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_s06_test")
@SpringBootTest @AutoConfigureMockMvc @Transactional
class ProjectDatabaseTest {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    User owner; User other; long javaId; long postgresId;
    @BeforeEach void prepare() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_s06_test");
        owner = users.saveAndFlush(new User("s06-owner@example.com", "test-hash"));
        other = users.saveAndFlush(new User("s06-other@example.com", "test-hash"));
        javaId = jdbc.queryForObject("select id from skill where name='Java'", Long.class);
        postgresId = jdbc.queryForObject("select id from skill where name='PostgreSQL'", Long.class);
    }
    private org.springframework.test.web.servlet.request.RequestPostProcessor as(User user) {
        return authentication(new UsernamePasswordAuthenticationToken(new CurrentUser(user.getId(), user.getEmail()), null,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }
    private String input(String name, String ids) {
        return "{\"name\":\"" + name + "\",\"description\":\"  line1\\nline2  \",\"startDate\":\"2026-01-01\","
                + "\"endDate\":null,\"role\":\" backend \",\"projectUrl\":\"https://example.com/project\",\"skillIds\":" + ids + "}";
    }
    private long create(String name, String ids) throws Exception {
        var result = mvc.perform(post("/api/me/projects").with(as(owner)).with(csrf()).contentType("application/json").content(input(name, ids)))
                .andExpect(status().isCreated()).andReturn();
        return json.readTree(result.getResponse().getContentAsString()).get("id").asLong();
    }
    @Test void crudAndRelationReplacementLeaveOwnedAndSharedSkillsIntact() throws Exception {
        jdbc.update("insert into user_skill(user_id, skill_id, created_at) values (?, ?, now())", owner.getId(), javaId);
        long id = create("  First  ", "[" + javaId + "," + postgresId + "," + javaId + "]");
        mvc.perform(get("/api/me/projects/" + id).with(as(owner))).andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("First")).andExpect(jsonPath("$.role").value("backend"))
                .andExpect(jsonPath("$.description").value("line1\nline2")).andExpect(jsonPath("$.endDate").isEmpty())
                .andExpect(jsonPath("$.skills.length()").value(2)).andExpect(jsonPath("$.userId").doesNotExist());
        // Retained PostgreSQL link must not conflict with its unique key during flush.
        mvc.perform(put("/api/me/projects/" + id).with(as(owner)).with(csrf()).contentType("application/json")
                .content(input("Updated", "[" + postgresId + "]"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.skills.length()").value(1)).andExpect(jsonPath("$.skills[0].id").value(postgresId));
        mvc.perform(get("/api/me/projects/" + id).with(as(owner))).andExpect(jsonPath("$.name").value("Updated"));
        mvc.perform(put("/api/me/projects/" + id).with(as(owner)).with(csrf()).contentType("application/json")
                .content(input("No skills", "[]"))).andExpect(status().isOk()).andExpect(jsonPath("$.skills").isEmpty());
        assertThat(jdbc.queryForObject("select count(*) from project_skill where project_id=?", Integer.class, id)).isZero();
        mvc.perform(put("/api/me/projects/" + id).with(as(owner)).with(csrf()).contentType("application/json")
                .content(input("Readded", "[" + postgresId + "]"))).andExpect(status().isOk());
        mvc.perform(delete("/api/me/projects/" + id).with(as(owner)).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(get("/api/me/projects/" + id).with(as(owner))).andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("select count(*) from project_skill where project_id=?", Integer.class, id)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from user_skill where user_id=?", Integer.class, owner.getId())).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from skill where id in (?, ?)", Integer.class, javaId, postgresId)).isEqualTo(2);
    }
    @Test void listUsesOnlySessionOwnerAndOtherUserCannotReadUpdateOrDelete() throws Exception {
        long id = create("Private", "[" + postgresId + "]");
        mvc.perform(get("/api/me/projects").with(as(other)).param("userId", owner.getId().toString()).header("X-User-Id", owner.getId()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/me/projects/" + id).with(as(other))).andExpect(status().isForbidden());
        mvc.perform(put("/api/me/projects/" + id).with(as(other)).with(csrf()).contentType("application/json").content(input("Hacked", "[]")))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/me/projects/" + id).with(as(other)).with(csrf())).andExpect(status().isForbidden());
        mvc.perform(get("/api/me/projects/" + id).with(as(owner))).andExpect(jsonPath("$.name").value("Private"));
        assertThat(jdbc.queryForObject("select count(*) from user_skill where user_id=?", Integer.class, owner.getId())).isZero();
    }
    @Test void unknownSkillsRejectWholeCreateOrUpdateAndKeepPreviousData() throws Exception {
        mvc.perform(post("/api/me/projects").with(as(owner)).with(csrf()).contentType("application/json")
                .content(input("Missing", "[" + javaId + ",9223372036854775807]"))).andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("select count(*) from project where user_id=?", Integer.class, owner.getId())).isZero();
        long id = create("Original", "[" + javaId + "]");
        mvc.perform(put("/api/me/projects/" + id).with(as(owner)).with(csrf()).contentType("application/json")
                .content(input("Changed", "[9223372036854775807]"))).andExpect(status().isNotFound());
        mvc.perform(get("/api/me/projects/" + id).with(as(owner))).andExpect(jsonPath("$.name").value("Original"))
                .andExpect(jsonPath("$.skills[0].id").value(javaId));
    }
    @Test void pagingIsStableAndInvalidParametersAndIdsReturn400Or404() throws Exception {
        long first = create("First", "[" + javaId + "," + postgresId + "]");
        long second = create("Second", "[]");
        jdbc.update("update project set created_at='2026-01-01T00:00:00Z' where id in (?, ?)", first, second);
        mvc.perform(get("/api/me/projects").with(as(owner)).param("size", "1"))
                .andExpect(jsonPath("$.items[0].id").value(second)).andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(get("/api/me/projects").with(as(owner)).param("size", "1").param("page", "1"))
                .andExpect(jsonPath("$.items[0].id").value(first)).andExpect(jsonPath("$.items[0].skills.length()").value(2));
        mvc.perform(get("/api/me/projects").with(as(owner)).param("page", "99"))
                .andExpect(jsonPath("$.items").isEmpty()).andExpect(jsonPath("$.totalElements").value(2));
        for (String[] pair : new String[][]{{"page", "-1"}, {"page", "2147483647"}, {"size", "0"}, {"size", "101"}, {"page", "abc"}}) {
            mvc.perform(get("/api/me/projects").with(as(owner)).param(pair[0], pair[1])).andExpect(status().isBadRequest());
        }
        for (String id : List.of("0", "-1", "abc", "9223372036854775808")) {
            mvc.perform(get("/api/me/projects/" + id).with(as(owner))).andExpect(status().isBadRequest());
        }
        mvc.perform(get("/api/me/projects/9223372036854775807").with(as(owner))).andExpect(status().isNotFound());
        mvc.perform(put("/api/me/projects/9223372036854775807").with(as(owner)).with(csrf()).contentType("application/json").content(input("None", "[]"))).andExpect(status().isNotFound());
        mvc.perform(delete("/api/me/projects/9223372036854775807").with(as(owner)).with(csrf())).andExpect(status().isNotFound());
    }
    @Test void databaseUniqueConstraintPreventsDuplicateProjectSkills() throws Exception {
        long id = create("Links", "[" + javaId + "]");
        assertThat(jdbc.update("insert into project_skill(project_id, skill_id) values (?, ?) on conflict do nothing", id, javaId)).isZero();
    }
    @Test void databaseDateConstraintRejectsInvalidRange() throws Exception {
        long id = create("Dates", "[]");
        assertThatThrownBy(() -> jdbc.update("update project set end_date='2025-01-01' where id=?", id))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }
    @Test void databaseForeignKeyRejectsUnknownSkill() throws Exception {
        long id = create("FK", "[]");
        assertThatThrownBy(() -> jdbc.update("insert into project_skill(project_id, skill_id) values (?, ?)", id, Long.MAX_VALUE))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }
}
