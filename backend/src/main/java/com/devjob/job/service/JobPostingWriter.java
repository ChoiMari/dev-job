package com.devjob.job.service;

import com.devjob.job.adapter.JobSourceDescriptor;
import com.devjob.job.adapter.RecruitmentDetails;
import com.devjob.job.entity.Company;
import com.devjob.job.entity.JobPosting;
import com.devjob.job.model.NormalizedJobPosting;
import com.devjob.job.repository.CompanyRepository;
import com.devjob.job.repository.JobPostingRepository;
import com.devjob.job.repository.JobSourceRepository;
import com.devjob.job.repository.JobRecruitmentDetailRepository;
import com.devjob.analysis.repository.AIAnalysisRepository;
import com.devjob.analysis.repository.JobSkillRepository;
import com.devjob.notification.NotificationEventRecorder;
import com.devjob.notification.NotificationType;
import java.util.Objects;
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
    private final JobRecruitmentDetailRepository details;
    private final AIAnalysisRepository analyses;
    private final JobSkillRepository jobSkills;
    private final NotificationEventRecorder notifications;

    public JobPostingWriter(JdbcTemplate jdbc, JobSourceRepository sources,
            CompanyRepository companies, JobPostingRepository postings, JobRecruitmentDetailRepository details,
            AIAnalysisRepository analyses, JobSkillRepository jobSkills, NotificationEventRecorder notifications) {
        this.jdbc = jdbc;
        this.sources = sources;
        this.companies = companies;
        this.postings = postings;
        this.details = details;
        this.analyses = analyses;
        this.jobSkills = jobSkills;
        this.notifications = notifications;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void registerSource(JobSourceDescriptor source) {
        jdbc.update("insert into job_source (code, name) values (?, ?) on conflict (code) do nothing",
                source.code(), source.name());
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean store(String sourceCode, NormalizedJobPosting input) {
        return store(sourceCode, input, null);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean store(String sourceCode, NormalizedJobPosting input, RecruitmentDetails recruitmentDetails) {
        // Serialize writes for a source so concurrent imports do not create duplicate companies.
        var source = sources.findByCodeForUpdate(sourceCode).orElseThrow();
        var existing = postings.findByJobSourceIdAndExternalId(source.getId(), input.externalId());
        if (existing.isPresent()) {
            if ("ALIO_RECRUITMENT".equals(sourceCode)) {
                var job = postings.lockById(existing.get().getId()).orElseThrow();
                boolean noticeChanged = !Objects.equals(job.getTitle(), input.title())
                        || !Objects.equals(job.getDeadlineDate(), input.deadlineDate())
                        || (recruitmentDetails != null && !Objects.equals(job.getDescription(), input.description()));
                boolean analysisStale = !Objects.equals(job.getTitle(), input.title())
                        || (recruitmentDetails != null && !Objects.equals(job.getDescription(), input.description()));
                var company = job.getCompany().getName().equals(input.companyName())
                        ? job.getCompany() : companies.save(new Company(input.companyName()));
                job.update(company, input, recruitmentDetails != null);
                postings.saveAndFlush(job);
                if (noticeChanged) {
                    String subject = "관심 공고가 변경되었습니다: " + job.getTitle();
                    long updateId = jdbc.queryForObject("insert into notification_job_update"
                            + "(job_posting_id,occurred_at,subject) values (?,?,?) returning id", Long.class,
                            job.getId(), java.sql.Timestamp.from(job.getUpdatedAt()),
                            subject.substring(0, Math.min(200, subject.length())));
                    notifications.record(NotificationType.SAVED_JOB_UPDATE, updateId, job.getUpdatedAt());
                }
                if (recruitmentDetails != null) details.replace(job.getId(), recruitmentDetails);
                if (analysisStale) analyses.findByJobId(job.getId()).ifPresent(analysis -> {
                    jobSkills.deleteForJob(job.getId());
                    analysis.failed();
                    analyses.saveAndFlush(analysis);
                });
            }
            return false;
        }
        // A company name is not a company identity. Preserve separate same-name companies.
        var company = companies.save(new Company(input.companyName()));
        var job = postings.saveAndFlush(new JobPosting(source, company, input));
        if (recruitmentDetails != null) details.replace(job.getId(), recruitmentDetails);
        return true;
    }
}
