package com.devjob.application;

import com.devjob.application.dto.ApplicationInput;
import com.devjob.application.entity.ApplicationStatus;
import com.devjob.application.repository.*;
import com.devjob.application.service.ApplicationService;
import com.devjob.job.entity.*;
import com.devjob.job.model.NormalizedJobPosting;
import com.devjob.job.repository.*;
import com.devjob.user.entity.User;
import com.devjob.user.repository.UserRepository;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;

@Tag("database")
@EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_s11_test")
@SpringBootTest
class ApplicationConcurrencyDatabaseTest {
    @Autowired ApplicationService service;
    @Autowired ApplicationRepository applications;
    @Autowired ApplicationStatusHistoryRepository histories;
    @Autowired UserRepository users;
    @Autowired JobPostingRepository jobs;
    @Autowired CompanyRepository companies;
    @Autowired JobSourceRepository sources;
    @Autowired PlatformTransactionManager manager;
    @Autowired JdbcTemplate jdbc;
    Long userId, jobId, companyId, sourceId;
    TransactionTemplate tx;
    @BeforeEach void seed() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_s11_test");
        tx = new TransactionTemplate(manager);
        tx.executeWithoutResult(status -> {
            String unique = UUID.randomUUID().toString();
            userId = users.saveAndFlush(new User(unique + "@example.com", "hash")).getId();
            var company = companies.save(new Company("S11 Concurrency")); companyId = company.getId();
            var source = sources.save(new JobSource(unique, "Test")); sourceId = source.getId();
            jobId = jobs.saveAndFlush(new JobPosting(source, company, new NormalizedJobPosting(
                    unique, "S11 Concurrency", "Backend", null, null, null, null, null, null, "https://example.com/job"))).getId();
        });
    }
    @AfterEach void cleanupOnlyOwnFixtures() {
        tx.executeWithoutResult(status -> {
            jdbc.update("delete from application_status_history where application_id in (select id from application where user_id = ?)", userId);
            jdbc.update("delete from application where user_id = ?", userId);
            jobs.deleteById(jobId); jobs.flush();
            companies.deleteById(companyId); sources.deleteById(sourceId); users.deleteById(userId);
        });
    }
    ApplicationInput.Create input() { return new ApplicationInput.Create(jobId, ApplicationStatus.PLANNED, null, null, null); }
    List<Integer> race(Callable<Integer> request) throws Exception {
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(2);
        try {
            Callable<Integer> task = () -> { ready.countDown(); if (!start.await(10, TimeUnit.SECONDS)) throw new AssertionError("start timeout"); return request.call(); };
            var first = pool.submit(task); var second = pool.submit(task);
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue(); start.countDown();
            return List.of(first.get(20, TimeUnit.SECONDS), second.get(20, TimeUnit.SECONDS));
        } finally { pool.shutdownNow(); }
    }
    @Test void concurrentDuplicateCreateCommitsOneApplicationAndOneInitialHistory() throws Exception {
        assertThat(race(() -> {
            try { service.create(userId, input()); return 201; }
            catch (ResponseStatusException error) { return error.getStatusCode().value(); }
        })).containsExactlyInAnyOrder(201, 409);
        var rows = applications.findByUserIdAndJobIdInAndDeletedAtIsNull(userId, List.of(jobId));
        assertThat(rows).hasSize(1);
        assertThat(histories.findByApplicationIdOrderByChangedAtAscIdAsc(rows.get(0).getId())).hasSize(1);
    }
    @Test void concurrentSameTransitionAppendsExactlyOneHistory() throws Exception {
        long id = service.create(userId, input()).id();
        assertThat(race(() -> {
            try { service.changeStatus(userId, id, new ApplicationInput.ChangeStatus(ApplicationStatus.WITHDRAWN, null)); return 200; }
            catch (ResponseStatusException error) { return error.getStatusCode().value(); }
        })).containsExactlyInAnyOrder(200, 409);
        assertThat(service.detail(userId, id).currentStatus()).isEqualTo(ApplicationStatus.WITHDRAWN);
        assertThat(service.history(userId, id)).hasSize(2);
    }
    @Test void rollbackNeverLeavesStatusAndHistoryOutOfSync() {
        assertThatThrownBy(() -> tx.executeWithoutResult(status -> { service.create(userId, input()); throw new IllegalStateException("rollback"); }))
                .isInstanceOf(IllegalStateException.class);
        assertThat(applications.findByUserIdAndJobIdInAndDeletedAtIsNull(userId, List.of(jobId))).isEmpty();
        long id = service.create(userId, input()).id();
        assertThatThrownBy(() -> tx.executeWithoutResult(status -> {
            service.changeStatus(userId, id, new ApplicationInput.ChangeStatus(ApplicationStatus.WITHDRAWN, null));
            throw new IllegalStateException("rollback");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(service.detail(userId, id).currentStatus()).isEqualTo(ApplicationStatus.PLANNED);
        assertThat(service.history(userId, id)).hasSize(1);
    }
}
