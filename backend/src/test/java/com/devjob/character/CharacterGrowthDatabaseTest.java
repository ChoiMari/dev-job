package com.devjob.character;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.character.dto.EquipItemRequest;
import com.devjob.character.repository.CharacterActivityRepository;
import com.devjob.character.service.CharacterGrowthService;
import com.devjob.character.service.CharacterService;
import com.devjob.todo.dto.TodoInput;
import com.devjob.todo.service.TodoService;
import com.devjob.user.entity.User;
import com.devjob.user.repository.UserRepository;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Tag("database") @EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_b10_test")
@SpringBootTest @AutoConfigureMockMvc
class CharacterGrowthDatabaseTest {
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired TodoService todos;
    @Autowired CharacterService characters;
    @Autowired CharacterGrowthService growth;
    @Autowired CharacterActivityRepository activities;
    @Autowired MockMvc mvc;

    @Test void firstCompletionConcurrentRetryClaimAndOwnerIsolation() throws Exception {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_b10_test");
        assertThat(jdbc.queryForObject("select count(*) from flyway_schema_history where version='22' and success", Integer.class))
                .isEqualTo(1);
        String suffix = UUID.randomUUID().toString();
        User owner = users.saveAndFlush(new User("b10-" + suffix + "@example.com", "test-hash"));
        User other = users.saveAndFlush(new User("b10-other-" + suffix + "@example.com", "test-hash"));
        try {
            long id = todos.create(owner.getId(), new TodoInput("Complete", null, null, null)).id();
            assertThatThrownBy(() -> growth.claim(owner.getId(), "TODO_1")).hasMessageContaining("409");
            var pool = Executors.newFixedThreadPool(2);
            var start = new CountDownLatch(1);
            try {
                Future<?> first = pool.submit(() -> complete(start, owner.getId(), id));
                Future<?> second = pool.submit(() -> complete(start, owner.getId(), id));
                start.countDown();
                first.get(10, TimeUnit.SECONDS);
                second.get(10, TimeUnit.SECONDS);
            } finally { pool.shutdownNow(); }
            assertThat(activities.countByUserIdAndActivityType(owner.getId(), "TODO_COMPLETED")).isEqualTo(1);
            assertThat(characters.state(owner.getId()).progress().totalExp()).isEqualTo(10);
            assertThat(characters.state(owner.getId()).equipment()).containsEntry("OUTFIT", "BASE");
            assertThat(growth.activity(owner.getId(), 0, 20).items()).singleElement()
                    .satisfies(activity -> assertThat(activity.activityId()).isEqualTo(id));
            assertThat(growth.quests(owner.getId()).get(0).completed()).isTrue();
            assertThat(growth.quests(owner.getId()).get(0).claimed()).isFalse();
            var claimPool = Executors.newFixedThreadPool(2);
            var claimStart = new CountDownLatch(1);
            com.devjob.character.dto.CharacterClaimResponse firstClaim;
            try {
                Future<com.devjob.character.dto.CharacterClaimResponse> first = claimPool.submit(() -> {
                    claimStart.await(); return growth.claim(owner.getId(), "TODO_1");
                });
                Future<com.devjob.character.dto.CharacterClaimResponse> second = claimPool.submit(() -> {
                    claimStart.await(); return growth.claim(owner.getId(), "TODO_1");
                });
                claimStart.countDown();
                firstClaim = first.get(10, TimeUnit.SECONDS);
                assertThat(second.get(10, TimeUnit.SECONDS)).isEqualTo(firstClaim);
            } finally { claimPool.shutdownNow(); }
            assertThat(jdbc.queryForObject("select count(*) from character_reward where user_id=?", Integer.class,
                    owner.getId())).isEqualTo(1);
            assertThat(growth.claim(owner.getId(), "TODO_1")).isEqualTo(firstClaim);
            assertThat(characters.items(owner.getId()).get(2).available()).isTrue();
            assertThat(characters.items(other.getId()).get(2).available()).isFalse();
            assertThatThrownBy(() -> characters.equip(other.getId(), "OUTFIT", new EquipItemRequest("PEACH")))
                    .hasMessageContaining("409");
            assertThat(characters.equip(owner.getId(), "OUTFIT", new EquipItemRequest("PEACH")).equippedItemId())
                    .isEqualTo("PEACH");
            todos.complete(owner.getId(), id, false);
            todos.complete(owner.getId(), id, true);
            todos.delete(owner.getId(), id);
            assertThat(characters.state(owner.getId()).progress().totalExp()).isEqualTo(10);
            assertThat(growth.quests(owner.getId()).get(0).claimed()).isTrue();
            long oldId = todos.create(owner.getId(), new TodoInput("Already completed before B10", null, null, null)).id();
            jdbc.update("update personal_todo set reward_eligible=false where id=?", oldId);
            todos.complete(owner.getId(), oldId, true);
            todos.complete(owner.getId(), oldId, false);
            todos.complete(owner.getId(), oldId, true);
            assertThat(activities.countByUserIdAndActivityType(owner.getId(), "TODO_COMPLETED")).isEqualTo(1);
            var auth = authentication(new UsernamePasswordAuthenticationToken(
                    new CurrentUser(owner.getId(), owner.getEmail()), null,
                    List.of(new SimpleGrantedAuthority("ROLE_USER"))));
            mvc.perform(get("/api/me/character").with(auth)).andExpect(status().isOk())
                    .andExpect(jsonPath("$.baseAssetId").value("EXT-IMG-06A"))
                    .andExpect(jsonPath("$.progress.totalExp").value(10));
            mvc.perform(get("/api/dashboard").with(auth)).andExpect(status().isOk());
            mvc.perform(get("/api/me/character/activity").with(auth).param("size", "101"))
                    .andExpect(status().isBadRequest());
            mvc.perform(get("/api/dashboard").with(auth)).andExpect(status().isOk());
            // In this disposable DB, break only the growth read and verify saved CRM data remains available.
            jdbc.execute("alter table character_activity rename to character_activity_unavailable");
            try {
                mvc.perform(get("/api/me/character/activity").with(auth)).andExpect(status().isInternalServerError());
                mvc.perform(get("/api/dashboard").with(auth)).andExpect(status().isOk());
            } finally {
                jdbc.execute("alter table character_activity_unavailable rename to character_activity");
            }
        } finally {
            jdbc.update("delete from character_reward where user_id=?", owner.getId());
            jdbc.update("delete from character_activity where user_id=?", owner.getId());
            jdbc.update("delete from character_equipment where user_id=?", owner.getId());
            jdbc.update("delete from personal_todo where user_id=?", owner.getId());
            users.deleteById(owner.getId());
            users.deleteById(other.getId());
        }
    }
    private void complete(CountDownLatch start, Long userId, long id) {
        try { start.await(); todos.complete(userId, id, true); }
        catch (InterruptedException exception) { Thread.currentThread().interrupt(); throw new RuntimeException(exception); }
    }
}
