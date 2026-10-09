package com.devjob.learninggoal;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.user.entity.User;
import com.devjob.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
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

@Tag("database") @EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_b07_test")
@SpringBootTest @AutoConfigureMockMvc @Transactional
class LearningGoalDatabaseTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired ObjectMapper json;
    @Autowired EntityManager entityManager;
    User owner; User other;
    long skillId;

    @BeforeEach void prepare() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_b07_test");
        String marker = UUID.randomUUID().toString();
        owner = users.saveAndFlush(new User("b07-owner-" + marker + "@example.com", "test-hash"));
        other = users.saveAndFlush(new User("b07-other-" + marker + "@example.com", "test-hash"));
        skillId = jdbc.queryForObject("select id from skill where name = 'Java'", Long.class);
    }
    private RequestPostProcessor as(User user) {
        return authentication(new UsernamePasswordAuthenticationToken(new CurrentUser(user.getId(), user.getEmail()), null,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }
    private long create(String body) throws Exception {
        var response = mvc.perform(post("/api/me/learning-goals").with(as(owner)).with(csrf())
                .contentType("application/json").content(body)).andExpect(status().isCreated()).andReturn();
        return json.readTree(response.getResponse().getContentAsString()).get("id").asLong();
    }

    @Test void lifecycleOwnershipAndSoftDelete() throws Exception {
        long id = create("{\"title\":\"  Java   심화  \",\"skillId\":" + skillId + ",\"progressPercent\":80}");
        entityManager.clear();
        mvc.perform(get("/api/me/learning-goals/" + id).with(as(owner)))
                .andExpect(jsonPath("$.title").value("Java 심화"))
                .andExpect(jsonPath("$.skill.id").value(skillId));
        mvc.perform(patch("/api/me/learning-goals/" + id + "/completion").with(as(owner)).with(csrf())
                .contentType("application/json").content("{\"completed\":true}"))
                .andExpect(status().isConflict());
        mvc.perform(patch("/api/me/learning-goals/" + id).with(as(owner)).with(csrf())
                .contentType("application/json").content("{\"progressPercent\":100}"))
                .andExpect(status().isOk());
        var completed = mvc.perform(patch("/api/me/learning-goals/" + id + "/completion")
                .with(as(owner)).with(csrf()).contentType("application/json").content("{\"completed\":true}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.completed").value(true)).andReturn();
        String completedAt = json.readTree(completed.getResponse().getContentAsString()).get("completedAt").asText();
        mvc.perform(patch("/api/me/learning-goals/" + id + "/completion")
                .with(as(owner)).with(csrf()).contentType("application/json").content("{\"completed\":true}"))
                .andExpect(jsonPath("$.completedAt").value(completedAt));
        mvc.perform(patch("/api/me/learning-goals/" + id).with(as(owner)).with(csrf())
                .contentType("application/json").content("{\"progressPercent\":99}"))
                .andExpect(status().isConflict());
        mvc.perform(get("/api/me/learning-goals").with(as(owner)).param("completed", "true"))
                .andExpect(jsonPath("$.items[0].id").value(id));
        mvc.perform(get("/api/me/learning-goals/" + id).with(as(other))).andExpect(status().isForbidden());
        mvc.perform(delete("/api/me/learning-goals/" + id).with(as(other)).with(csrf()))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/api/me/learning-goals/" + id + "/completion")
                .with(as(owner)).with(csrf()).contentType("application/json").content("{\"completed\":false}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.progressPercent").value(100))
                .andExpect(jsonPath("$.completedAt").isEmpty());
        mvc.perform(delete("/api/me/learning-goals/" + id).with(as(owner)).with(csrf()))
                .andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("select deleted_at is not null from learning_goal where id=?", Boolean.class, id)).isTrue();
        mvc.perform(get("/api/me/learning-goals/" + id).with(as(owner))).andExpect(status().isNotFound());
        mvc.perform(delete("/api/me/learning-goals/" + id).with(as(owner)).with(csrf()))
                .andExpect(status().isNotFound());
        create("{\"title\":\"Java 심화\",\"skillId\":" + skillId + "}");
    }

    @Test void goalDoesNotMutateSkillsOrGap() throws Exception {
        jdbc.update("insert into user_skill(user_id,skill_id,created_at,proficiency_level,experience_months) "
                + "values (?,?,now(),3,24)", owner.getId(), skillId);
        long id = create("{\"title\":\"학습\",\"skillId\":" + skillId + ",\"progressPercent\":100}");
        String before = mvc.perform(get("/api/me/skill-gap").with(as(owner)))
                .andReturn().getResponse().getContentAsString();
        mvc.perform(patch("/api/me/learning-goals/" + id + "/completion")
                .with(as(owner)).with(csrf()).contentType("application/json").content("{\"completed\":true}"))
                .andExpect(status().isOk());
        assertThat(jdbc.queryForMap("select proficiency_level,experience_months from user_skill "
                + "where user_id=? and skill_id=?", owner.getId(), skillId))
                .containsEntry("proficiency_level", 3).containsEntry("experience_months", 24);
        assertThat(mvc.perform(get("/api/me/skill-gap").with(as(owner)))
                .andReturn().getResponse().getContentAsString()).isEqualTo(before);
        mvc.perform(delete("/api/me/skills/" + skillId).with(as(owner)).with(csrf()))
                .andExpect(status().isNoContent());
        assertThat(mvc.perform(get("/api/me/skill-gap").with(as(owner)))
                .andReturn().getResponse().getContentAsString()).isNotEqualTo(before);
        mvc.perform(get("/api/me/learning-goals/" + id).with(as(owner)))
                .andExpect(jsonPath("$.skill.id").value(skillId));
    }

    @Test void skillLinkCanChangeAndDuplicateUpdateConflicts() throws Exception {
        long first = create("{\"title\":\"Same\"}");
        long second = create("{\"title\":\"Same\",\"skillId\":" + skillId + "}");
        mvc.perform(patch("/api/me/learning-goals/" + first).with(as(owner)).with(csrf())
                .contentType("application/json").content("{\"description\":\"  practice  \"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.description").value("practice"));
        mvc.perform(patch("/api/me/learning-goals/" + second).with(as(owner)).with(csrf())
                .contentType("application/json").content("{\"skillId\":null}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONFLICT"));
    }

    @Test void authValidationAndDuplicateKey() throws Exception {
        long id = create("{\"title\":\"Same   goal\"}");
        mvc.perform(get("/api/me/learning-goals")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/me/learning-goals").with(as(owner)).contentType("application/json")
                .content("{\"title\":\"missing csrf\"}")).andExpect(status().isForbidden());
        mvc.perform(get("/api/me/learning-goals/0").with(as(owner))).andExpect(status().isBadRequest());
        mvc.perform(get("/api/me/learning-goals").with(as(owner)).param("size", "101"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/me/learning-goals").with(as(owner)).param("completed", "1"))
                .andExpect(status().isBadRequest());
        mvc.perform(patch("/api/me/learning-goals/" + id).with(as(owner)).with(csrf())
                .contentType("application/json").content("{\"progressPercent\":null}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/me/learning-goals").with(as(owner)).with(csrf())
                .contentType("application/json").content("{\"title\":\"Missing\",\"skillId\":999999999}"))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/me/learning-goals").with(as(owner)).with(csrf())
                .contentType("application/json").content("{\"title\":\" Same goal \"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONFLICT"));
    }
}
