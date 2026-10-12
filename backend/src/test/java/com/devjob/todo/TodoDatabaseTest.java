package com.devjob.todo;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.user.entity.User;
import com.devjob.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
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
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Tag("database") @EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_b03_test")
@SpringBootTest @AutoConfigureMockMvc @Transactional
class TodoDatabaseTest {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired EntityManager entityManager;
    User owner; User other;

    @BeforeEach void prepare() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_b03_test");
        owner = users.saveAndFlush(new User("b03-owner@example.com", "test-hash"));
        other = users.saveAndFlush(new User("b03-other@example.com", "test-hash"));
    }
    private RequestPostProcessor as(User user) {
        return authentication(new UsernamePasswordAuthenticationToken(new CurrentUser(user.getId(), user.getEmail()), null,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }
    private long create(String body) throws Exception {
        var result = mvc.perform(post("/api/me/todos").with(as(owner)).with(csrf()).contentType("application/json").content(body))
                .andExpect(status().isCreated()).andReturn();
        return json.readTree(result.getResponse().getContentAsString()).get("id").asLong();
    }
    @Test void crudPersistsAcrossReloadAndKeepsDashboardActionsSeparate() throws Exception {
        long id = create("{\"title\":\"  지원서 검토  \",\"description\":\"  확인  \","
                + "\"dueAt\":\"2026-10-15T18:00:00+09:00\",\"dueTimeZone\":\"Asia/Seoul\"}");
        entityManager.clear();
        mvc.perform(get("/api/me/todos/" + id).with(as(owner))).andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("지원서 검토"))
                .andExpect(jsonPath("$.description").value("확인"))
                .andExpect(jsonPath("$.dueAt").value("2026-10-15T18:00:00+09:00"))
                .andExpect(jsonPath("$.completed").value(false));
        mvc.perform(get("/api/dashboard").with(as(owner))).andExpect(jsonPath("$.personalTodos[0].id").value(id))
                .andExpect(jsonPath("$.nextActions").isEmpty());
        mvc.perform(patch("/api/me/todos/" + id).with(as(owner)).with(csrf()).contentType("application/json")
                .content("{\"title\":\"수정\",\"dueAt\":null,\"dueTimeZone\":null}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.dueAt").isEmpty());
        entityManager.clear();
        mvc.perform(get("/api/me/todos/" + id).with(as(owner))).andExpect(jsonPath("$.title").value("수정"));
        var completed = mvc.perform(patch("/api/me/todos/" + id + "/completion").with(as(owner)).with(csrf())
                .contentType("application/json").content("{\"completed\":true}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.completed").value(true)).andReturn();
        String completedAt = json.readTree(completed.getResponse().getContentAsString()).get("completedAt").asText();
        entityManager.clear();
        mvc.perform(patch("/api/me/todos/" + id + "/completion").with(as(owner)).with(csrf())
                .contentType("application/json").content("{\"completed\":true}"))
                .andExpect(jsonPath("$.completedAt").value(completedAt));
        mvc.perform(get("/api/me/todos").with(as(owner)).param("completed", "true"))
                .andExpect(jsonPath("$.items[0].id").value(id));
        mvc.perform(get("/api/dashboard").with(as(owner))).andExpect(jsonPath("$.personalTodos").isEmpty());
        mvc.perform(patch("/api/me/todos/" + id + "/completion").with(as(owner)).with(csrf())
                .contentType("application/json").content("{\"completed\":false}"))
                .andExpect(jsonPath("$.completedAt").isEmpty());
        mvc.perform(delete("/api/me/todos/" + id).with(as(owner)).with(csrf())).andExpect(status().isNoContent());
        entityManager.clear();
        assertThat(jdbc.queryForObject("select deleted_at is not null from personal_todo where id=?", Boolean.class, id)).isTrue();
        mvc.perform(get("/api/me/todos/" + id).with(as(owner))).andExpect(status().isNotFound());
        mvc.perform(get("/api/me/todos").with(as(owner))).andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(delete("/api/me/todos/" + id).with(as(owner)).with(csrf())).andExpect(status().isNotFound());
    }
    @Test void ownershipAuthenticationAndInvalidInput() throws Exception {
        long id = create("{\"title\":\"Private\"}");
        mvc.perform(get("/api/me/todos").with(as(other)).param("userId", owner.getId().toString()))
                .andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(get("/api/me/todos/" + id).with(as(other))).andExpect(status().isForbidden());
        mvc.perform(patch("/api/me/todos/" + id).with(as(other)).with(csrf()).contentType("application/json")
                .content("{\"title\":\"Hacked\"}" )).andExpect(status().isForbidden());
        mvc.perform(patch("/api/me/todos/" + id + "/completion").with(as(other)).with(csrf())
                .contentType("application/json").content("{\"completed\":true}" )).andExpect(status().isForbidden());
        mvc.perform(delete("/api/me/todos/" + id).with(as(other)).with(csrf())).andExpect(status().isForbidden());
        mvc.perform(get("/api/me/todos")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/me/todos").with(as(owner)).contentType("application/json")
                .content("{\"title\":\"No csrf\"}")).andExpect(status().isForbidden());
        for (String body : List.of("{}", "{\"title\":\"  \"}",
                "{\"title\":\"bad\",\"dueAt\":\"2026-10-15T18:00:00+09:00\"}",
                "{\"title\":\"bad\",\"dueAt\":\"2026-10-15T18:00:00+08:00\",\"dueTimeZone\":\"Asia/Seoul\"}",
                "{\"title\":\"bad\",\"dueAt\":\"2026-10-15T18:00:00+09:00\",\"dueTimeZone\":\"+09:00\"}")) {
            mvc.perform(post("/api/me/todos").with(as(owner)).with(csrf()).contentType("application/json").content(body))
                    .andExpect(status().isBadRequest());
        }
        mvc.perform(patch("/api/me/todos/" + id).with(as(owner)).with(csrf()).contentType("application/json")
                .content("{\"unknown\":1}")).andExpect(status().isBadRequest());
        mvc.perform(patch("/api/me/todos/" + id).with(as(owner)).with(csrf()).contentType("application/json")
                .content("{\"title\":null}")).andExpect(status().isBadRequest());
        mvc.perform(patch("/api/me/todos/" + id + "/completion").with(as(owner)).with(csrf())
                .contentType("application/json").content("{}")).andExpect(status().isBadRequest());
        mvc.perform(patch("/api/me/todos/" + id + "/completion").with(as(owner)).with(csrf())
                .contentType("application/json").content("{\"completed\":\"true\"}")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/me/todos").with(as(owner)).param("size", "101")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/me/todos/0").with(as(owner))).andExpect(status().isBadRequest());
        mvc.perform(get("/api/me/todos/9223372036854775807").with(as(owner))).andExpect(status().isNotFound());
        mvc.perform(get("/api/me/todos/" + id).with(as(owner))).andExpect(jsonPath("$.title").value("Private"));
    }
    @Test void listSortFilterAndCompletionDoNotChangeOtherTodos() throws Exception {
        long undated = create("{\"title\":\"Undated\"}");
        long dated = create("{\"title\":\"Dated\",\"dueAt\":\"2026-10-15T18:00:00.123456789+09:00\","
                + "\"dueTimeZone\":\"Asia/Seoul\"}");
        entityManager.clear();
        mvc.perform(get("/api/me/todos/" + dated).with(as(owner)))
                .andExpect(jsonPath("$.dueAt").value("2026-10-15T18:00:00.123456+09:00"));
        mvc.perform(get("/api/me/todos").with(as(owner)).param("size", "1"))
                .andExpect(jsonPath("$.items[0].id").value(dated)).andExpect(jsonPath("$.totalElements").value(2));
        mvc.perform(get("/api/me/todos").with(as(owner)).param("size", "1").param("page", "1"))
                .andExpect(jsonPath("$.items[0].id").value(undated));
        mvc.perform(patch("/api/me/todos/" + dated + "/completion").with(as(owner)).with(csrf())
                .contentType("application/json").content("{\"completed\":true}")).andExpect(status().isOk());
        entityManager.clear();
        mvc.perform(get("/api/me/todos").with(as(owner)).param("completed", "false"))
                .andExpect(jsonPath("$.items[0].id").value(undated)).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/me/todos").with(as(owner)).param("completed", "true"))
                .andExpect(jsonPath("$.items[0].id").value(dated)).andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get("/api/dashboard").with(as(owner))).andExpect(jsonPath("$.personalTodos[0].id").value(undated))
                .andExpect(jsonPath("$.nextActions").isEmpty());
    }
    @Test void categoriesAreOwnedAndCannotBeRemovedWhileUsed() throws Exception {
        var created = mvc.perform(post("/api/me/todos/categories").with(as(owner)).with(csrf())
                .contentType("application/json").content("{\"name\":\"건강\",\"iconKey\":\"health\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.name").value("건강"))
                .andExpect(jsonPath("$.iconKey").value("health")).andReturn();
        long categoryId = json.readTree(created.getResponse().getContentAsString()).get("id").asLong();
        mvc.perform(get("/api/me/todos/categories").with(as(other)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(8));
        mvc.perform(get("/api/me/todos/categories").with(as(owner)))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].name").value("서류"))
                .andExpect(jsonPath("$[8].iconKey").value("health"));
        mvc.perform(patch("/api/me/todos/categories/" + categoryId).with(as(owner)).with(csrf())
                .contentType("application/json").content("{\"name\":\"건강 관리\",\"iconKey\":\"trophy\",\"colorKey\":\"sky\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.name").value("건강 관리"))
                .andExpect(jsonPath("$.iconKey").value("trophy"))
                .andExpect(jsonPath("$.colorKey").value("sky"));
        mvc.perform(patch("/api/me/todos/categories/" + categoryId).with(as(other)).with(csrf())
                .contentType("application/json").content("{\"name\":\"침범\"}"))
                .andExpect(status().isNotFound());
        var order = mvc.perform(get("/api/me/todos/categories").with(as(owner))).andReturn();
        var ids = json.readTree(order.getResponse().getContentAsString());
        var reordered = json.createArrayNode();
        reordered.add(categoryId);
        for (var item : ids) if (item.get("id").asLong() != categoryId) reordered.add(item.get("id").asLong());
        mvc.perform(put("/api/me/todos/categories/order").with(as(owner)).with(csrf())
                .contentType("application/json").content(json.createObjectNode().set("ids", reordered).toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(categoryId));
        mvc.perform(post("/api/me/todos/categories").with(as(owner)).with(csrf())
                .contentType("application/json").content("{\"name\":\"운동\",\"iconKey\":\"unknown\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/me/todos/categories").with(as(owner)).with(csrf())
                .contentType("application/json").content("{\"name\":\"건강 관리\"}"))
                .andExpect(status().isConflict());
        long todoId = create("{\"title\":\"운동\",\"category\":\"건강 관리\",\"reminderMinutes\":10}");
        mvc.perform(get("/api/me/todos/" + todoId).with(as(owner)))
                .andExpect(jsonPath("$.category").value("건강 관리"))
                .andExpect(jsonPath("$.reminderMinutes").value(10));
        mvc.perform(patch("/api/me/todos/categories/" + categoryId).with(as(owner)).with(csrf())
                .contentType("application/json").content("{\"name\":\"운동 관리\"}"))
                .andExpect(status().isOk());
        entityManager.clear();
        mvc.perform(get("/api/me/todos/" + todoId).with(as(owner)))
                .andExpect(jsonPath("$.category").value("운동 관리"));
        mvc.perform(post("/api/me/todos").with(as(other)).with(csrf()).contentType("application/json")
                .content("{\"title\":\"타인 카테고리\",\"category\":\"건강\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(delete("/api/me/todos/categories/" + categoryId).with(as(owner)).with(csrf()))
                .andExpect(status().isConflict());
        mvc.perform(patch("/api/me/todos/" + todoId).with(as(owner)).with(csrf())
                .contentType("application/json").content("{\"category\":\"기타\",\"reminderMinutes\":-1}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.category").value("기타"))
                .andExpect(jsonPath("$.reminderMinutes").value(-1));
        mvc.perform(delete("/api/me/todos/categories/" + categoryId).with(as(owner)).with(csrf()))
                .andExpect(status().isNoContent());
        mvc.perform(post("/api/me/todos").with(as(owner)).with(csrf()).contentType("application/json")
                .content("{\"title\":\"잘못된 알림\",\"reminderMinutes\":5}"))
                .andExpect(status().isBadRequest());
    }
}
