package com.devjob.job.adapter;

import java.util.List;

/** Provider boundary: implementations map their response into external postings, without DB access. */
public interface JobSourceAdapter {
    JobSourceDescriptor source();
    List<ExternalJobPosting> fetchJobs(JobSearchCondition condition);
}
