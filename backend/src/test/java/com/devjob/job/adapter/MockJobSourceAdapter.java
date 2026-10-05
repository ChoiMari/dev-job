package com.devjob.job.adapter;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/** Deliberately fictitious provider schema. This is not a Work24 response contract. */
public final class MockJobSourceAdapter implements JobSourceAdapter {
    private final JobSourceDescriptor source;
    private final List<ExternalJobPosting> response;

    public MockJobSourceAdapter(JobSourceDescriptor source, List<ExternalJobPosting> response) {
        this.source = source;
        this.response = response;
    }

    public static MockJobSourceAdapter fixture() throws IOException {
        try (var stream = MockJobSourceAdapter.class.getResourceAsStream("/fixtures/mock-jobs.json")) {
            JsonNode rows = new ObjectMapper().readTree(stream);
            List<ExternalJobPosting> postings = new ArrayList<>();
            for (var row : rows) {
                postings.add(new ExternalJobPosting(value(row, "id"), value(row, "corpName"),
                        value(row, "jobTitle"), value(row, "body"), value(row, "type"),
                        value(row, "career"), value(row, "area"), value(row, "published"),
                        value(row, "expires"), value(row, "url")));
            }
            return new MockJobSourceAdapter(new JobSourceDescriptor(" mock ", " 모의 출처 "), postings);
        }
    }

    private static String value(JsonNode row, String field) {
        var node = row.get(field);
        return node == null || node.isNull() ? null : node.asText();
    }

    @Override
    public JobSourceDescriptor source() { return source; }

    @Override
    public List<ExternalJobPosting> fetchJobs(JobSearchCondition condition) { return response; }
}
