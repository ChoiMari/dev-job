package com.devjob.skill;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.skill.service.SkillNormalizer;
import com.devjob.user.entity.User;
import com.devjob.user.repository.UserRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
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
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Tag("database")
@EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_b02_test")
@SpringBootTest @AutoConfigureMockMvc @Transactional
class SkillExperienceDatabaseTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired SkillNormalizer normalizer;
    private User first;
    private User second;
    private long skillId;

    @BeforeEach void prepare() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_b02_test");
        first = users.saveAndFlush(new User("b02-first@example.com", "test-hash"));
        second = users.saveAndFlush(new User("b02-second@example.com", "test-hash"));
        skillId = normalizer.resolveExisting("Java").orElseThrow().getId();
    }

    private RequestPostProcessor as(User user) {
        return authentication(new UsernamePasswordAuthenticationToken(new CurrentUser(user.getId(), user.getEmail()), null,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }

    @Test void storesPartialChangesAndClearsExplicitNullForOwnerOnly() throws Exception {
        mvc.perform(post("/api/me/skills").with(as(first)).with(csrf()).contentType("application/json")
                .content("{\"skillId\":" + skillId + "}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(skillId))
                .andExpect(jsonPath("$.proficiencyLevel").doesNotExist());
        mvc.perform(get("/api/me/skills").with(as(first))).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].proficiencyLevel").value((Object) null))
                .andExpect(jsonPath("$.items[0].experienceMonths").value((Object) null));
        mvc.perform(patch("/api/me/skills/" + skillId + "/experience").with(as(first)).with(csrf())
                .contentType("application/json").content("{\"proficiencyLevel\":3,\"experienceMonths\":24}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.proficiencyLevel").value(3))
                .andExpect(jsonPath("$.experienceMonths").value(24));
        mvc.perform(get("/api/me/skills").with(as(first))).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].proficiencyLevel").value(3))
                .andExpect(jsonPath("$.items[0].experienceMonths").value(24));
        mvc.perform(get("/api/skills").with(as(first)).param("q", "Java"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(skillId))
                .andExpect(jsonPath("$.items[0].proficiencyLevel").doesNotExist());
        mvc.perform(patch("/api/me/skills/" + skillId + "/experience").with(as(first)).with(csrf())
                .contentType("application/json").content("{\"experienceMonths\":0}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.proficiencyLevel").value(3))
                .andExpect(jsonPath("$.experienceMonths").value(0));
        mvc.perform(patch("/api/me/skills/" + skillId + "/experience").with(as(second)).with(csrf())
                .contentType("application/json").content("{\"proficiencyLevel\":5}"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/me/skills").with(as(second))).andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(patch("/api/me/skills/" + skillId + "/experience").with(as(first)).with(csrf())
                .contentType("application/json").content("{\"proficiencyLevel\":null,\"experienceMonths\":null}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.proficiencyLevel").value((Object) null))
                .andExpect(jsonPath("$.experienceMonths").value((Object) null));
    }

    @Test void deletionAndReregistrationLosePreviousValues() throws Exception {
        mvc.perform(post("/api/me/skills").with(as(first)).with(csrf()).contentType("application/json")
                .content("{\"skillId\":" + skillId + "}")) .andExpect(status().isCreated());
        mvc.perform(patch("/api/me/skills/" + skillId + "/experience").with(as(first)).with(csrf())
                .contentType("application/json").content("{\"proficiencyLevel\":5,\"experienceMonths\":600}"))
                .andExpect(status().isOk());
        mvc.perform(delete("/api/me/skills/" + skillId).with(as(first)).with(csrf()))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/me/skills").with(as(first)).with(csrf()).contentType("application/json")
                .content("{\"skillId\":" + skillId + "}")) .andExpect(status().isCreated());
        mvc.perform(get("/api/me/skills").with(as(first)))
                .andExpect(jsonPath("$.items[0].proficiencyLevel").value((Object) null))
                .andExpect(jsonPath("$.items[0].experienceMonths").value((Object) null));
    }
}
