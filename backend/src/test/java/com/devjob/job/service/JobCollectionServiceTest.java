package com.devjob.job.service;

import com.devjob.job.adapter.*;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;
import static com.devjob.job.service.JobCollectionResult.Status.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class JobCollectionServiceTest {
    private final JobPostingWriter writer = mock(JobPostingWriter.class);
    private final JobCollectionService service = new JobCollectionService(new JobPostingNormalizer(), writer);
    private final JobSearchCondition condition = new JobSearchCondition(null, 0, 20);
    private final JobSourceDescriptor source = new JobSourceDescriptor("MOCK", "모의");

    @Test
    void providerFailureDoesNotTouchStorageAndDoesNotRetry() {
        var adapter = mock(JobSourceAdapter.class);
        when(adapter.source()).thenReturn(source);
        when(adapter.fetchJobs(condition)).thenThrow(new IllegalStateException("private provider details"));
        assertThat(service.collect(adapter, condition))
                .isEqualTo(new JobCollectionResult(SOURCE_FAILED, 0, 0, 0, 0));
        verify(adapter, times(1)).fetchJobs(condition);
        verifyNoInteractions(writer);
    }

    @Test
    void nullProviderResponseIsSourceFailure() {
        assertThat(service.collect(new MockJobSourceAdapter(source, null), condition).status())
                .isEqualTo(SOURCE_FAILED);
        verifyNoInteractions(writer);
    }

    @Test
    void rejectedAndFailedRowsDoNotBlockLaterRows() {
        var first = posting("first");
        var last = posting("last");
        var invalid = new ExternalJobPosting("bad", null, "제목", null, null, null, null,
                null, null, "https://example.com");
        when(writer.store(eq("MOCK"), argThat(p -> p != null && p.externalId().equals("first"))))
                .thenThrow(new IllegalStateException("storage unavailable"));
        when(writer.store(eq("MOCK"), argThat(p -> p != null && p.externalId().equals("last")))).thenReturn(true);
        var result = service.collect(new MockJobSourceAdapter(source,
                Arrays.asList(first, invalid, null, last)), condition);
        assertThat(result).isEqualTo(new JobCollectionResult(PARTIAL_FAILURE, 1, 0, 2, 1));
        verify(writer).store(eq("MOCK"), argThat(p -> p.externalId().equals("last")));
    }

    @Test
    void sourceStorageFailureIsReportedWithoutAttemptingPostings() {
        doThrow(new IllegalStateException("database unavailable")).when(writer).registerSource(source);
        assertThat(service.collect(new MockJobSourceAdapter(source, List.of(posting("id"))), condition))
                .isEqualTo(new JobCollectionResult(STORAGE_FAILED, 0, 0, 0, 1));
        verify(writer).registerSource(source);
        verifyNoMoreInteractions(writer);
    }

    @Test
    void emptySuccessRegistersSourceAndDoesNotInventPostings() {
        assertThat(service.collect(new MockJobSourceAdapter(source, List.of()), condition))
                .isEqualTo(new JobCollectionResult(COMPLETED, 0, 0, 0, 0));
        verify(writer).registerSource(source);
        verifyNoMoreInteractions(writer);
    }

    private ExternalJobPosting posting(String id) {
        return new ExternalJobPosting(id, "회사", "제목", null, null, null, null,
                null, null, "https://example.com/jobs/" + id);
    }
}
