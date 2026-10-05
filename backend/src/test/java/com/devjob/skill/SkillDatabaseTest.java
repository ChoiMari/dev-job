package com.devjob.skill;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.skill.dto.AddSkillRequest;
import com.devjob.skill.repository.*;
import com.devjob.skill.service.*;
import com.devjob.user.entity.User;
import com.devjob.user.repository.UserRepository;
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
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Tag("database")
@EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_s05_test")
@SpringBootTest @AutoConfigureMockMvc @Transactional
class SkillDatabaseTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired SkillRepository skills;
    @Autowired SkillNormalizer normalizer;
    @Autowired SkillService service;
    private User first;
    private User second;
    @BeforeEach void prepare() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_s05_test");
        first = users.saveAndFlush(new User("skill-first@example.com", "test-hash"));
        second = users.saveAndFlush(new User("skill-second@example.com", "test-hash"));
    }
    private org.springframework.test.web.servlet.request.RequestPostProcessor as(User user) {
        return authentication(new UsernamePasswordAuthenticationToken(new CurrentUser(user.getId(), user.getEmail()), null,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }
    private void add(String body, int expected) throws Exception {
        mvc.perform(post("/api/me/skills").with(as(first)).with(csrf()).contentType("application/json").content(body))
                .andExpect(status().is(expected));
    }
    @Test void aliasAddReadDeleteFlowAndOwnerIsolation() throws Exception {
        long id = normalizer.resolveExisting("postgresql").orElseThrow().getId();
        mvc.perform(post("/api/me/skills").with(as(first)).with(csrf()).contentType("application/json")
                .content("{\"name\":\"  POSTGRES  \"}")).andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(id)).andExpect(jsonPath("$.name").value("PostgreSQL"));
        add("{\"skillId\":" + id + "}", 409);
        add("{\"name\":\"PostgreSQL\"}", 409);
        mvc.perform(get("/api/me/skills").with(as(first)).param("userId", second.getId().toString())
                .header("X-User-Id", second.getId())).andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.items[0].id").value(id));
        mvc.perform(get("/api/me/skills").with(as(second))).andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(delete("/api/me/skills/" + id).with(as(second)).with(csrf())
                .param("userId", first.getId().toString()).header("X-User-Id", first.getId())).andExpect(status().isNotFound());
        assertThat(service.list(first.getId())).hasSize(1);
        mvc.perform(delete("/api/me/skills/" + id).with(as(first)).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(get("/api/me/skills").with(as(first))).andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(delete("/api/me/skills/" + id).with(as(first)).with(csrf())).andExpect(status().isNotFound());
        assertThat(skills.existsById(id)).isTrue();
    }
    @Test void explicitUserNameMayCreateButExternalResolutionCannot() throws Exception {
        long count = skills.count();
        assertThat(normalizer.resolveExisting("New S05 Technology")).isEmpty();
        assertThat(skills.count()).isEqualTo(count);
        add("{\"name\":\"  New   S05 Technology  \"}", 201);
        add("{\"name\":\"new s05 technology\"}", 409);
        var resolved = normalizer.resolveExisting("Ｎew S05 Technology").orElseThrow();
        assertThat(resolved.getName()).isEqualTo("New S05 Technology");
        assertThat(service.add(second.getId(), new AddSkillRequest(null, "NEW S05 TECHNOLOGY")).id()).isEqualTo(resolved.getId());
        assertThat(skills.count()).isEqualTo(count + 1);
        assertThat(jdbc.queryForObject("select count(*) from skill_alias where normalized_name='new s05 technology'", Integer.class)).isEqualTo(1);
    }
    @Test void rejectsUnknownIdsAndInvalidNamesOrPagination() throws Exception {
        add("{\"skillId\":9223372036854775807}", 404);
        for (String body : new String[]{"{\"name\":\"   \"}", "{\"name\":\"Java\\u0000\"}", "{\"name\":\"Java\\n\"}"}) add(body, 400);
        mvc.perform(delete("/api/me/skills/0").with(as(first)).with(csrf())).andExpect(status().isBadRequest());
        for (String[] query : new String[][]{{"page", "-1"}, {"page", "2147483647"}, {"size", "0"}, {"size", "101"}, {"q", " "}, {"page", "abc"}, {"q", "a".repeat(101)}}) {
            mvc.perform(get("/api/skills").with(as(first)).param(query[0], query[1])).andExpect(status().isBadRequest());
        }
    }
    @Test void searchMatchesAliasesOnceAndTreatsWildcardsLiterally() throws Exception {
        mvc.perform(get("/api/skills").with(as(first)).param("q", "Postgres")).andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.items[0].name").value("PostgreSQL"))
                .andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/skills").with(as(first)).param("q", "%")).andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(get("/api/skills").with(as(first)).param("size", "1").param("page", "1"))
                .andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.page").value(1)).andExpect(jsonPath("$.size").value(1));
        assertThat(normalizer.resolveExisting("SpringBoot").orElseThrow().getName()).isEqualTo("Spring Boot");
        assertThat(normalizer.resolveExisting("JPA").orElseThrow().getName()).isEqualTo("JPA");
        assertThat(normalizer.resolveExisting("C++").orElseThrow().getId()).isNotEqualTo(normalizer.resolveExisting("C#").orElseThrow().getId());
    }
    @Test void databaseRejectsDuplicateRelationsAliasesAndMissingReferences() {
        long skill = normalizer.resolveExisting("Java").orElseThrow().getId();
        assertThat(jdbc.update("insert into user_skill(user_id, skill_id, created_at) values (?, ?, now()) on conflict do nothing", first.getId(), skill)).isEqualTo(1);
        assertThat(jdbc.update("insert into user_skill(user_id, skill_id, created_at) values (?, ?, now()) on conflict do nothing", first.getId(), skill)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from skill_alias where normalized_name='postgres'", Integer.class)).isEqualTo(1);
        assertThatThrownBy(() -> jdbc.update("insert into user_skill(user_id, skill_id, created_at) values (?, ?, now())", first.getId(), Long.MAX_VALUE))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }
}
