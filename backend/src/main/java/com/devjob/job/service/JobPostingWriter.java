package com.devjob.job.service;

import com.devjob.job.adapter.JobSourceDescriptor;
import com.devjob.job.entity.Company;
import com.devjob.job.entity.JobPosting;
import com.devjob.job.model.NormalizedJobPosting;
import com.devjob.job.repository.CompanyRepository;
import com.devjob.job.repository.JobPostingRepository;
import com.devjob.job.repository.JobSourceRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class JobPostingWriter {
    private final JdbcTemplate jdbc;
    private final JobSourceRepository sources;
    private final CompanyRepository companies;
    private final JobPostingRepository postings;

    public JobPostingWriter(JdbcTemplate jdbc, JobSourceRepository sources,
            CompanyRepository companies, JobPostingRepository postings) {
        this.jdbc = jdbc;
        this.sources = sources;
        this.companies = companies;
        this.postings = postings;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void registerSource(JobSourceDescriptor source) {
        jdbc.update("insert into job_source (code, name) values (?, ?) on conflict (code) do nothing",
                source.code(), source.name());
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean store(String sourceCode, NormalizedJobPosting input) {
        // Serialize writes for a source so concurrent imports do not create duplicate companies.
        var source = sources.findByCodeForUpdate(sourceCode).orElseThrow();
        if (postings.findByJobSourceIdAndExternalId(source.getId(), input.externalId()).isPresent()) {
            return false;
        }
        // A company name is not a company identity. Preserve separate same-name companies.
        var company = companies.save(new Company(input.companyName()));
        postings.saveAndFlush(new JobPosting(source, company, input));
        return true;
    }
}
