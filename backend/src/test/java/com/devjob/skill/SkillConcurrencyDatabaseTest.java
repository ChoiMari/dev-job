package com.devjob.skill;

import com.devjob.skill.dto.AddSkillRequest;
import com.devjob.skill.service.SkillService;
import com.devjob.user.entity.User;
import com.devjob.user.repository.UserRepository;
import java.util.UUID;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;

@Tag("database")
@EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_s05_test")
@SpringBootTest
class SkillConcurrencyDatabaseTest {
    @Autowired SkillService service;
    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;
    @Test void concurrentCaseVariantsCreateOneCatalogAndOneOwnedRelation() throws Exception {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_s05_test");
        String name = "Concurrent-" + UUID.randomUUID();
        var user = users.saveAndFlush(new User(UUID.randomUUID() + "@example.com", "test-hash"));
        var gate = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(2);
        try {
            Callable<Integer> first = () -> run(gate, user.getId(), name);
            Callable<Integer> second = () -> run(gate, user.getId(), name.toUpperCase(java.util.Locale.ROOT));
            var a = pool.submit(first); var b = pool.submit(second); gate.countDown();
            assertThat(java.util.List.of(a.get(15, TimeUnit.SECONDS), b.get(15, TimeUnit.SECONDS))).containsExactlyInAnyOrder(201, 409);
            assertThat(service.list(user.getId())).hasSize(1);
            assertThat(jdbc.queryForObject("select count(*) from skill where normalized_name=?", Integer.class, name.toLowerCase(java.util.Locale.ROOT))).isEqualTo(1);
            assertThat(jdbc.queryForObject("select count(*) from skill_alias where normalized_name=?", Integer.class, name.toLowerCase(java.util.Locale.ROOT))).isEqualTo(1);
        } finally { pool.shutdownNow(); }
    }
    private int run(CountDownLatch gate, Long user, String name) throws Exception {
        if (!gate.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("gate timeout");
        try { service.add(user, new AddSkillRequest(null, name)); return 201; }
        catch (ResponseStatusException exception) { return exception.getStatusCode().value(); }
    }
}
