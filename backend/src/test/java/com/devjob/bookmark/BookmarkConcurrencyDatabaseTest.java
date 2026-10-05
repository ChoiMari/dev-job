package com.devjob.bookmark;

import com.devjob.bookmark.dto.AddBookmarkRequest;
import com.devjob.bookmark.service.BookmarkService;
import com.devjob.job.entity.*;
import com.devjob.job.model.NormalizedJobPosting;
import com.devjob.job.repository.*;
import com.devjob.user.entity.User;
import com.devjob.user.repository.UserRepository;
import java.util.List;
import java.util.UUID;
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

@Tag("database") @EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_s10_test")
@SpringBootTest
class BookmarkConcurrencyDatabaseTest {
    @Autowired BookmarkService service;
    @Autowired UserRepository users;
    @Autowired JobPostingRepository jobs;
    @Autowired CompanyRepository companies;
    @Autowired JobSourceRepository sources;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactions;
    @Test void simultaneousSavesReturnOneCreatedAndOneConflictWithoutDuplicate() throws Exception {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_s10_test");
        var tx = new TransactionTemplate(transactions);
        long[] ids = tx.execute(status -> {
            var user = users.save(new User(UUID.randomUUID() + "@example.com", "test-hash"));
            var source = sources.save(new JobSource("S10-" + UUID.randomUUID(), "Test"));
            var company = companies.save(new Company("Concurrent S10"));
            var job = jobs.save(new JobPosting(source, company, new NormalizedJobPosting("concurrent", company.getName(),
                    "Concurrent", null, null, null, null, null, null, "https://example.com/jobs/1")));
            return new long[]{user.getId(), job.getId(), company.getId(), source.getId()};
        });
        var pool = Executors.newFixedThreadPool(2);
        var gate = new CountDownLatch(1);
        try {
            Callable<Integer> save = () -> {
                if (!gate.await(5, TimeUnit.SECONDS)) throw new IllegalStateException("gate timeout");
                try { service.add(ids[0], new AddBookmarkRequest(ids[1])); return 201; }
                catch (ResponseStatusException e) { return e.getStatusCode().value(); }
            };
            var first = pool.submit(save); var second = pool.submit(save); gate.countDown();
            assertThat(List.of(first.get(15, TimeUnit.SECONDS), second.get(15, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(201, 409);
            assertThat(service.list(ids[0], 0, 20).totalElements()).isEqualTo(1);
            assertThat(jdbc.queryForObject("select count(*) from bookmark where user_id=? and job_posting_id=?",
                    Integer.class, ids[0], ids[1])).isEqualTo(1);
        } finally {
            pool.shutdownNow();
            if (!pool.awaitTermination(10, TimeUnit.SECONDS)) throw new IllegalStateException("save threads still running");
            // Only records created by this test are removed, in its guarded disposable DB.
            tx.executeWithoutResult(status -> {
                jdbc.update("delete from bookmark where user_id=?", ids[0]);
                jdbc.update("delete from job_posting where id=?", ids[1]);
                jdbc.update("delete from company where id=?", ids[2]);
                jdbc.update("delete from job_source where id=?", ids[3]);
                jdbc.update("delete from users where id=?", ids[0]);
            });
        }
    }
}
