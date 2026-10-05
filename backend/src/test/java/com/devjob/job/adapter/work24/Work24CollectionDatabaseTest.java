package com.devjob.job.adapter.work24;

import com.devjob.job.adapter.JobSearchCondition;
import com.devjob.job.repository.CompanyRepository;
import com.devjob.job.repository.JobPostingRepository;
import com.devjob.job.repository.JobSourceRepository;
import com.devjob.job.service.JobCollectionResult;
import com.devjob.job.service.JobCollectionService;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import static com.devjob.job.service.JobCollectionResult.Status.*;
import static org.assertj.core.api.Assertions.*;

/** Loopback provider plus real PostgreSQL. Only a disposable test database is allowed. */
@Tag("database")
@EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_s07_test")
@SpringBootTest
class Work24CollectionDatabaseTest {
    @Autowired JobCollectionService collection;
    @Autowired Work24Adapter unconfiguredAdapter;
    @Autowired JobPostingRepository postings;
    @Autowired CompanyRepository companies;
    @Autowired JobSourceRepository sources;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactionManager;
    private HttpServer server;
    private Work24Adapter adapter;
    private final AtomicReference<byte[]> response = new AtomicReference<>();
    private final AtomicInteger statusCode = new AtomicInteger(200);
    private final AtomicInteger calls = new AtomicInteger();
    private final JobSearchCondition condition = new JobSearchCondition(null, 0, 20);

    @BeforeEach
    void prepareIsolatedDatabaseAndLoopbackProvider() throws Exception {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_s07_test");
        jdbc.update("delete from job_posting");
        jdbc.update("delete from company");
        jdbc.update("delete from job_source");
        try (var stream = getClass().getResourceAsStream("/fixtures/work24-open-recruitment.xml")) {
            response.set(stream.readAllBytes());
        }
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/open-recruitment", exchange -> {
            calls.incrementAndGet();
            byte[] currentResponse = response.get();
            exchange.sendResponseHeaders(statusCode.get(), currentResponse.length);
            try (exchange) { exchange.getResponseBody().write(currentResponse); }
        });
        server.start();
        adapter = new Work24Adapter("database-fixture-key", new Work24HttpClient(),
                URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/open-recruitment"));
    }

    @AfterEach
    void stopProvider() { if (server != null) { server.stop(0); } }

    @Test
    void actualHttpXmlCollectionUsesExistingNormalizationAndPreservesDuplicates() {
        assertThat(collection.collect(adapter, condition))
                .isEqualTo(new JobCollectionResult(PARTIAL_FAILURE, 1, 1, 1, 0));
        var before = jdbc.queryForList("select * from job_posting");
        assertThat(collection.collect(adapter, condition))
                .isEqualTo(new JobCollectionResult(PARTIAL_FAILURE, 0, 2, 1, 0));
        assertThat(jdbc.queryForList("select * from job_posting")).isEqualTo(before);
        assertThat(postings.count()).isEqualTo(1);
        assertThat(companies.count()).isEqualTo(1);
        assertThat(sources.count()).isEqualTo(1);
        new TransactionTemplate(transactionManager).executeWithoutResult(tx -> {
            var stored = postings.findAll().get(0);
            assertThat(stored.getJobSource().getCode()).isEqualTo("WORK24_OPEN_RECRUITMENT");
            assertThat(stored.getExternalId()).isEqualTo("Open-AbC-1");
            assertThat(stored.getCompany().getName()).isEqualTo("모의 기업");
            assertThat(stored.getTitle()).isEqualTo("백엔드 개발자 공채");
            assertThat(stored.getEmploymentType()).isEqualTo("정규직");
            assertThat(stored.getDescription()).isNull();
        });
        assertThat(calls).hasValue(2);
    }

    @Test
    void httpAndXmlFailuresPreserveStoredDataCallerTransactionAndAuthenticationData() {
        collection.collect(adapter, condition);
        var before = jdbc.queryForList("select * from job_posting");
        var usersBefore = jdbc.queryForList("select * from users");
        var transactions = new TransactionTemplate(transactionManager);
        statusCode.set(503);
        transactions.executeWithoutResult(tx -> {
            assertThat(collection.collect(adapter, condition).status()).isEqualTo(SOURCE_FAILED);
            assertThat(tx.isRollbackOnly()).isFalse();
            assertThat(postings.findAll()).hasSize(1);
            jdbc.update("update job_posting set title = ? where external_id = ?",
                    "caller change survives", "Open-AbC-1");
        });
        assertThat(jdbc.queryForObject("select title from job_posting", String.class))
                .isEqualTo("caller change survives");
        statusCode.set(200);
        response.set("<GO24><error>provider private details</error></GO24>".getBytes(StandardCharsets.UTF_8));
        var afterCallerChange = jdbc.queryForList("select * from job_posting");
        assertThat(collection.collect(adapter, condition).status()).isEqualTo(SOURCE_FAILED);
        assertThat(jdbc.queryForList("select * from job_posting")).isEqualTo(afterCallerChange);
        assertThat(jdbc.queryForList("select * from users")).isEqualTo(usersBefore);
        response.set(singlePosting());
        assertThat(collection.collect(adapter, condition).duplicates()).isEqualTo(1);
        assertThat(postings.count()).isEqualTo(before.size());
        assertThat(calls).hasValue(4);
    }

    @Test
    void concurrentWork24RequestsStillCreateOnlyOnePostingAndCompany() throws Exception {
        response.set(singlePosting());
        var executor = Executors.newFixedThreadPool(2);
        var start = new CountDownLatch(1);
        try {
            var first = executor.submit(() -> { start.await(); return collection.collect(adapter, condition); });
            var second = executor.submit(() -> { start.await(); return collection.collect(adapter, condition); });
            start.countDown();
            var results = List.of(first.get(15, TimeUnit.SECONDS), second.get(15, TimeUnit.SECONDS));
            assertThat(results).allMatch(result -> result.status() == COMPLETED);
            assertThat(results.stream().mapToInt(JobCollectionResult::created).sum()).isEqualTo(1);
            assertThat(results.stream().mapToInt(JobCollectionResult::duplicates).sum()).isEqualTo(1);
            assertThat(postings.count()).isEqualTo(1);
            assertThat(companies.count()).isEqualTo(1);
            assertThat(sources.count()).isEqualTo(1);
            assertThat(calls).hasValue(2);
        } finally {
            executor.shutdownNow();
            assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
        }
    }

    private byte[] singlePosting() {
        return ("""
                <dhsOpenEmpInfoList><total>1</total><dhsOpenEmpInfo>
                <empSeqno>Open-AbC-1</empSeqno><empBusiNm>모의 기업</empBusiNm>
                <empWantedTitle>백엔드 개발자 공채</empWantedTitle>
                <empWantedHomepgDetail>https://example.com/recruit/Open-AbC-1</empWantedHomepgDetail>
                </dhsOpenEmpInfo></dhsOpenEmpInfoList>
                """).getBytes(StandardCharsets.UTF_8);
    }
}
