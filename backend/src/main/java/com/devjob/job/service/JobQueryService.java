package com.devjob.job.service;

import com.devjob.job.dto.*;
import com.devjob.bookmark.repository.BookmarkRepository;
import com.devjob.analysis.repository.AIAnalysisRepository;
import com.devjob.analysis.repository.JobSkillRepository;
import com.devjob.analysis.entity.AIAnalysis;
import com.devjob.job.entity.JobPosting;
import com.devjob.job.repository.JobPostingRepository;
import com.devjob.job.repository.JobMatchQueryRepository;
import com.devjob.job.repository.JobRecruitmentDetailRepository;
import com.devjob.analysis.entity.JobSkill;
import com.devjob.application.entity.Application;
import com.devjob.application.repository.ApplicationRepository;
import com.devjob.application.service.ApplicationService;
import jakarta.persistence.criteria.*;
import java.util.ArrayList;
import java.util.Locale;
import java.util.HashSet;
import java.util.Set;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class JobQueryService {
    private final JobPostingRepository jobs;
    private final BookmarkRepository bookmarks;
    private final ApplicationRepository applications;
    private final AIAnalysisRepository analyses;
    private final JobSkillRepository jobSkills;
    private final JobMatchQueryRepository matchQueries;
    private final JobRecruitmentDetailRepository recruitmentDetails;
    public JobQueryService(JobPostingRepository jobs, BookmarkRepository bookmarks, ApplicationRepository applications,
            AIAnalysisRepository analyses, JobSkillRepository jobSkills, JobMatchQueryRepository matchQueries,
            JobRecruitmentDetailRepository recruitmentDetails) {
        this.jobs = jobs; this.bookmarks = bookmarks; this.applications = applications;
        this.analyses = analyses; this.jobSkills = jobSkills; this.matchQueries = matchQueries;
        this.recruitmentDetails = recruitmentDetails;
    }

    public JobPage search(Long userId, JobQuery input) {
        input.validate();
        if (input.sort().equals("matchRate") || input.minimumRate() != null) return rankedSearch(userId, input);
        Specification<JobPosting> specification = (root, query, cb) -> {
            var company = root.join("company");
            if (query.getResultType() != Long.class) {
                root.fetch("company"); root.fetch("jobSource");
                String date = input.sort().equals("deadline") ? "deadlineDate" : "postedDate";
                var datePath = root.get(date);
                var nullsLast = cb.<Integer>selectCase().when(cb.isNull(datePath), 1).otherwise(0);
                query.orderBy(cb.asc(nullsLast), input.sort().equals("deadline") ? cb.asc(datePath) : cb.desc(datePath),
                        cb.desc(root.get("id")));
            }
            var filters = new ArrayList<Predicate>();
            if (input.itOnly()) filters.add(cb.or(ItJobTitles.TERMS.stream()
                    .map(term -> contains(cb, root.get("title"), term)).toArray(Predicate[]::new)));
            if (input.role() != null) {
                var terms = JobRoles.OTHER.equals(input.role()) ? JobRoles.ALL_TERMS : JobRoles.TERMS.get(input.role());
                var matchingRole = cb.or(terms.stream()
                        .map(term -> contains(cb, root.get("title"), term)).toArray(Predicate[]::new));
                filters.add(JobRoles.OTHER.equals(input.role()) ? cb.not(matchingRole) : matchingRole);
            }
            if (input.source() != null) filters.add(cb.equal(root.join("jobSource").get("code"), input.source()));
            if (input.applicationStatus() != null) {
                var owned = query.subquery(Long.class);
                var application = owned.from(Application.class);
                owned.select(application.get("id")).where(cb.equal(application.get("user").get("id"), userId),
                        cb.equal(application.get("job").get("id"), root.get("id")),
                        cb.equal(application.get("currentStatus"), ApplicationService.parseStatus(input.applicationStatus())));
                filters.add(cb.exists(owned));
            }
            if (input.q() != null) filters.add(input.q().length() < 3
                    ? cb.or(contains(cb, root.get("title"), input.q()), contains(cb, company.get("name"), input.q()))
                    : cb.or(contains(cb, root.get("title"), input.q()), contains(cb, company.get("name"), input.q()),
                            contains(cb, root.get("description"), input.q())));
            if (input.company() != null) filters.add(contains(cb, company.get("name"), input.company()));
            if (input.location() != null) filters.add(contains(cb, root.get("location"), input.location()));
            if (input.careerLevel() != null) filters.add(cb.equal(cb.lower(root.get("careerRequirement")), input.careerLevel().toLowerCase(Locale.ROOT)));
            if (!input.bands().isEmpty()) filters.add(cb.or(input.bands().stream()
                    .map(band -> cb.isTrue(cb.function("regexp_like", Boolean.class, root.get("careerRequirement"),
                            cb.literal(JobCareerBands.PATTERNS.get(band)), cb.literal("i"))))
                    .toArray(Predicate[]::new)));
            if (input.employmentType() != null) filters.add(cb.equal(cb.lower(root.get("employmentType")), input.employmentType().toLowerCase(Locale.ROOT)));
            if (input.deadline() != null) filters.add(cb.lessThanOrEqualTo(root.get("deadlineDate"), input.deadline()));
            if (input.skill() != null) {
                var matching = query.subquery(Long.class);
                var requirement = matching.from(JobSkill.class);
                var analysis = matching.from(AIAnalysis.class);
                matching.select(requirement.get("id")).where(
                        cb.equal(requirement.get("job").get("id"), root.get("id")),
                        cb.equal(requirement.get("skill").get("id"), input.skill()),
                        cb.equal(analysis.get("job").get("id"), root.get("id")),
                        cb.equal(analysis.get("status"), AIAnalysis.Status.COMPLETED));
                filters.add(cb.exists(matching));
            }
            return cb.and(filters.toArray(Predicate[]::new));
        };
        var page = jobs.findAll(specification, PageRequest.of(input.page(), input.size()));
        var ids = page.getContent().stream().map(JobPosting::getId).toList();
        Set<Long> saved = ids.isEmpty() ? Set.of() : new HashSet<>(bookmarks.findSavedJobIds(userId, ids));
        var statuses = new java.util.HashMap<Long, String>();
        var rates = matchQueries.ratesForJobs(userId, ids);
        if (!ids.isEmpty()) applications.findByUserIdAndJobIdInAndDeletedAtIsNull(userId, ids)
                .forEach(application -> statuses.put(application.getJob().getId(), application.getCurrentStatus().name()));
        return new JobPage(page.getContent().stream().map(job ->
                JobSummary.from(job, saved.contains(job.getId()), statuses.get(job.getId()), rates.get(job.getId()))).toList(),
                input.page(), input.size(), page.getTotalElements());
    }

    private JobPage rankedSearch(Long userId, JobQuery input) {
        var ranked = matchQueries.ranked(userId, input);
        var ids = ranked.ids();
        if (ids.isEmpty()) return new JobPage(java.util.List.of(), input.page(), input.size(), ranked.total());
        var byId = new java.util.HashMap<Long, JobPosting>();
        jobs.findAllById(ids).forEach(job -> byId.put(job.getId(), job));
        var saved = new HashSet<>(bookmarks.findSavedJobIds(userId, ids));
        var statuses = new java.util.HashMap<Long, String>();
        applications.findByUserIdAndJobIdInAndDeletedAtIsNull(userId, ids)
                .forEach(application -> statuses.put(application.getJob().getId(), application.getCurrentStatus().name()));
        var rates = matchQueries.ratesForJobs(userId, ids);
        return new JobPage(ids.stream().map(id -> JobSummary.from(byId.get(id), saved.contains(id), statuses.get(id), rates.get(id))).toList(),
                input.page(), input.size(), ranked.total());
    }

    public JobDetail detail(Long userId, long id) {
        if (id < 1) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        var job = jobs.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        var owned = applications.findByUserIdAndJobIdInAndDeletedAtIsNull(userId, java.util.List.of(id));
        var analysis = analyses.findByJobId(id).orElse(null);
        return JobDetail.from(job, bookmarks.existsByUserIdAndJobId(userId, id),
                owned.isEmpty() ? null : owned.get(0).getCurrentStatus().name(), analysis,
                analysis != null && analysis.getStatus() == AIAnalysis.Status.COMPLETED ? jobSkills.findForJob(id) : java.util.List.of(),
                matchQueries.ratesForJobs(userId, java.util.List.of(id)).get(id),
                "ALIO_RECRUITMENT".equals(job.getJobSource().getCode()) ? recruitmentDetails.find(id) : null);
    }

    private Predicate contains(CriteriaBuilder cb, Expression<String> field, String value) {
        String escaped = value.toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return cb.like(cb.lower(field), "%" + escaped + "%", '\\');
    }
}
