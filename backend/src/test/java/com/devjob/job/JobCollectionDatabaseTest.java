package com.devjob.job;

import com.devjob.job.adapter.*;
import com.devjob.job.repository.CompanyRepository;
import com.devjob.job.repository.JobPostingRepository;
import com.devjob.job.repository.JobSourceRepository;
import com.devjob.job.service.JobCollectionResult;
import com.devjob.job.service.JobCollectionService;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import static com.devjob.job.service.JobCollectionResult.Status.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Runs only against a disposable S07 test database, never the development database. */
@Tag("database")
@EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_s07_test")
@SpringBootTest
class JobCollectionDatabaseTest {
    @Autowired JobCollectionService collection;
    @Autowired JobPostingRepository postings;
    @Autowired CompanyRepository companies;
    @Autowired JobSourceRepository sources;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager transactionManager;
    private final JobSearchCondition condition = new JobSearchCondition(null, 0, 20);
    private TransactionTemplate transactions;

    @BeforeEach
    void prepareDisposableDatabase() {
        assertThat(jdbc.queryForObject("select current_database()", String.class)).isEqualTo("devjob_s07_test");
        jdbc.update("delete from job_posting");
        jdbc.update("delete from company");
        jdbc.update("delete from job_source");
        transactions = new TransactionTemplate(transactionManager);
    }

    @Test
    void fictitiousProviderResponseIsNormalizedStoredAndLinked() throws Exception {
        assertThat(collection.collect(MockJobSourceAdapter.fixture(), condition))
                .isEqualTo(new JobCollectionResult(PARTIAL_FAILURE, 2, 1, 1, 0));
        assertThat(sources.count()).isEqualTo(1);
        assertThat(companies.count()).isEqualTo(2);
        transactions.executeWithoutResult(status -> {
            var source = sources.findByCode("MOCK").orElseThrow();
            assertThat(source.getName()).isEqualTo("모의 출처");
            var first = postings.findByJobSourceIdAndExternalId(source.getId(), "posting-1").orElseThrow();
            var second = postings.findByJobSourceIdAndExternalId(source.getId(), "posting-2").orElseThrow();
            assertThat(first.getJobSource().getId()).isEqualTo(source.getId());
            assertThat(first.getCompany().getName()).isEqualTo("모의 기업");
            assertThat(first.getTitle()).isEqualTo("백엔드 개발자");
            assertThat(first.getDescription()).isEqualTo("Java 개발\n협업 경험");
            assertThat(first.getEmploymentType()).isEqualTo("정규직");
            assertThat(first.getCareerRequirement()).isEqualTo("신입");
            assertThat(first.getLocation()).isEqualTo("서울");
            assertThat(first.getPostedDate()).isEqualTo(LocalDate.of(2026, 10, 1));
            assertThat(first.getDeadlineDate()).isEqualTo(LocalDate.of(2026, 10, 31));
            assertThat(first.getSourceUrl()).isEqualTo("https://example.com/jobs/1");
            assertThat(first.getCreatedAt()).isNotNull();
            assertThat(first.getUpdatedAt()).isEqualTo(first.getCreatedAt());
            assertThat(second.getCompany().getName()).isEqualTo(first.getCompany().getName());
            assertThat(second.getCompany().getId()).isNotEqualTo(first.getCompany().getId());
            assertThat(second.getDescription()).isNull();
            assertThat(second.getLocation()).isNull();
            assertThat(second.getPostedDate()).isNull();
            assertThat(second.getDeadlineDate()).isNull();
        });
    }

    @Test
    void repeatedCollectionPreservesExistingPostingCompanyAndTimestamps() throws Exception {
        collection.collect(MockJobSourceAdapter.fixture(), condition);
        var before = jdbc.queryForList("select * from job_posting order by external_id");
        assertThat(collection.collect(MockJobSourceAdapter.fixture(), condition))
                .isEqualTo(new JobCollectionResult(PARTIAL_FAILURE, 0, 3, 1, 0));
        assertThat(jdbc.queryForList("select * from job_posting order by external_id")).isEqualTo(before);
        assertThat(companies.count()).isEqualTo(2);
        assertThat(sources.count()).isEqualTo(1);
    }

    @Test
    void sameExternalIdInDifferentSourcesRemainsDistinct() {
        assertThat(collect("MOCK_A", List.of(posting("same-id", "company"))).created()).isEqualTo(1);
        assertThat(collect("MOCK_B", List.of(posting("same-id", "company"))).created()).isEqualTo(1);
        assertThat(collect(" mock_a ", List.of(posting("same-id", "company"))).duplicates()).isEqualTo(1);
        assertThat(postings.count()).isEqualTo(2);
        assertThat(sources.count()).isEqualTo(2);
        assertThat(companies.count()).isEqualTo(2);
    }

    @Test
    void malformedRowsDoNotCreateCompaniesOrPreventFollowingValidRow() {
        var missingCompany = posting("bad-company", " ");
        var invalidDate = new ExternalJobPosting("bad-date", "company", "title",
                null, null, null, null, "2026-02-30", null, "https://example.com");
        var reversedDates = new ExternalJobPosting("reversed", "company", "title",
                null, null, null, null, "2026-10-05", "2026-10-04", "https://example.com");
        assertThat(collect("MOCK", List.of(missingCompany, invalidDate, reversedDates, posting("good", "company"))))
                .isEqualTo(new JobCollectionResult(PARTIAL_FAILURE, 1, 0, 3, 0));
        assertThat(postings.count()).isEqualTo(1);
        assertThat(companies.count()).isEqualTo(1);
    }

    @Test
    void databaseWriteFailureRollsBackCompanyAndLaterRowsStillCommit() {
        // PostgreSQL text cannot contain NUL: induce a real storage error after Company insertion.
        var broken = new ExternalJobPosting("broken", "company", "title",
                "body" + (char) 0, null, null, null, null, null, "https://example.com");
        assertThat(collect("MOCK", List.of(posting("before", "company"), broken, posting("after", "company"))))
                .isEqualTo(new JobCollectionResult(PARTIAL_FAILURE, 2, 0, 0, 1));
        assertThat(postings.count()).isEqualTo(2);
        assertThat(companies.count()).isEqualTo(2);
        assertThat(jdbc.queryForList("select external_id from job_posting", String.class))
                .containsExactlyInAnyOrder("before", "after");
    }

    @Test
    void externalFailurePreservesStoredDataAndCallerTransactionAndRecovery() {
        collect("MOCK", List.of(posting("existing", "company")));
        var before = jdbc.queryForList("select * from job_posting");
        var failing = mock(JobSourceAdapter.class);
        when(failing.source()).thenReturn(new JobSourceDescriptor("MOCK", "mock"));
        when(failing.fetchJobs(condition)).thenAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isFalse();
            throw new IllegalStateException("private credentials");
        });
        transactions.executeWithoutResult(status -> {
            assertThat(collection.collect(failing, condition).status()).isEqualTo(SOURCE_FAILED);
            assertThat(status.isRollbackOnly()).isFalse();
            var stored = postings.findAll();
            assertThat(stored).hasSize(1);
            assertThat(stored.get(0).getCompany().getName()).isEqualTo("company");
            assertThat(stored.get(0).getTitle()).isEqualTo("title");
        });
        assertThat(jdbc.queryForList("select * from job_posting")).isEqualTo(before);
        verify(failing, times(1)).fetchJobs(condition);
        assertThat(collect("MOCK", List.of(posting("new", "company"))).created()).isEqualTo(1);
        assertThat(postings.count()).isEqualTo(2);
    }

    @Test
    void databaseEnforcesDuplicateKeyReferencesRequiredFieldsAndDates() {
        collect("MOCK", List.of(posting("existing", "company")));
        String copy = """
                insert into job_posting
                (job_source_id, external_id, company_id, title, source_url, created_at, updated_at)
                select job_source_id, external_id, company_id, title, source_url, created_at, updated_at
                from job_posting limit 1
                """;
        assertThatExceptionOfType(DataIntegrityViolationException.class).isThrownBy(() -> jdbc.update(copy));
        assertThatExceptionOfType(DataIntegrityViolationException.class)
                .isThrownBy(() -> jdbc.update("update job_posting set company_id = -1"));
        assertThatExceptionOfType(DataIntegrityViolationException.class)
                .isThrownBy(() -> jdbc.update("update job_posting set job_source_id = -1"));
        for (var field : List.of("external_id", "title", "source_url")) {
            assertThatExceptionOfType(DataIntegrityViolationException.class)
                    .isThrownBy(() -> jdbc.update("update job_posting set " + field + " = null"));
        }
        assertThatExceptionOfType(DataIntegrityViolationException.class).isThrownBy(() ->
                jdbc.update("update job_posting set posted_date='2026-10-05', deadline_date='2026-10-04'"));
        assertThatExceptionOfType(DataIntegrityViolationException.class).isThrownBy(() ->
                jdbc.update("insert into job_source (code, name) values ('MOCK', 'duplicate')"));
        assertThatExceptionOfType(DataIntegrityViolationException.class)
                .isThrownBy(() -> jdbc.update("insert into company (name) values (' ')"));
        assertThat(postings.count()).isEqualTo(1);
    }

    @Test
    void simultaneousImportsProduceOnlyOnePostingAndCompany() throws Exception {
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        JobSourceAdapter adapter = new JobSourceAdapter() {
            public JobSourceDescriptor source() { return new JobSourceDescriptor("MOCK", "mock"); }
            public List<ExternalJobPosting> fetchJobs(JobSearchCondition requested) {
                ready.countDown();
                try {
                    if (!start.await(10, TimeUnit.SECONDS)) {
                        throw new IllegalStateException("Concurrent fetch timed out");
                    }
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException("Concurrent fetch interrupted");
                }
                return List.of(posting("same", "company"));
            }
        };
        var executor = Executors.newFixedThreadPool(2);
        try {
            var first = executor.submit(() -> collection.collect(adapter, condition));
            var second = executor.submit(() -> collection.collect(adapter, condition));
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            var results = List.of(first.get(15, TimeUnit.SECONDS), second.get(15, TimeUnit.SECONDS));
            assertThat(results).allMatch(result -> result.status() == COMPLETED);
            assertThat(results.stream().mapToInt(JobCollectionResult::created).sum()).isEqualTo(1);
            assertThat(results.stream().mapToInt(JobCollectionResult::duplicates).sum()).isEqualTo(1);
            assertThat(postings.count()).isEqualTo(1);
            assertThat(companies.count()).isEqualTo(1);
            assertThat(sources.count()).isEqualTo(1);
        } finally {
            start.countDown();
            executor.shutdownNow();
            assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
        }
    }

    private JobCollectionResult collect(String code, List<ExternalJobPosting> response) {
        return collection.collect(new MockJobSourceAdapter(new JobSourceDescriptor(code, "mock"), response), condition);
    }

    private ExternalJobPosting posting(String id, String company) {
        return new ExternalJobPosting(id, company, "title", "body", null, null, null,
                null, null, "https://example.com/jobs/" + id);
    }
}
