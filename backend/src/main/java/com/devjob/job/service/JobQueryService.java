package com.devjob.job.service;

import com.devjob.job.dto.*;
import com.devjob.bookmark.repository.BookmarkRepository;
import com.devjob.job.entity.JobPosting;
import com.devjob.job.repository.JobPostingRepository;
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
    public JobQueryService(JobPostingRepository jobs, BookmarkRepository bookmarks) {
        this.jobs = jobs; this.bookmarks = bookmarks;
    }

    public JobPage search(Long userId, JobQuery input) {
        input.validate();
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
            if (input.q() != null) filters.add(cb.or(contains(cb, root.get("title"), input.q()),
                    contains(cb, company.get("name"), input.q())));
            if (input.company() != null) filters.add(contains(cb, company.get("name"), input.company()));
            if (input.location() != null) filters.add(contains(cb, root.get("location"), input.location()));
            if (input.careerLevel() != null) filters.add(cb.equal(cb.lower(root.get("careerRequirement")), input.careerLevel().toLowerCase(Locale.ROOT)));
            if (input.employmentType() != null) filters.add(cb.equal(cb.lower(root.get("employmentType")), input.employmentType().toLowerCase(Locale.ROOT)));
            if (input.deadline() != null) filters.add(cb.lessThanOrEqualTo(root.get("deadlineDate"), input.deadline()));
            return cb.and(filters.toArray(Predicate[]::new));
        };
        var page = jobs.findAll(specification, PageRequest.of(input.page(), input.size()));
        var ids = page.getContent().stream().map(JobPosting::getId).toList();
        Set<Long> saved = ids.isEmpty() ? Set.of() : new HashSet<>(bookmarks.findSavedJobIds(userId, ids));
        return new JobPage(page.getContent().stream().map(job -> JobSummary.from(job, saved.contains(job.getId()))).toList(),
                input.page(), input.size(), page.getTotalElements());
    }

    public JobDetail detail(Long userId, long id) {
        if (id < 1) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        var job = jobs.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return JobDetail.from(job, bookmarks.existsByUserIdAndJobId(userId, id));
    }

    private Predicate contains(CriteriaBuilder cb, Expression<String> field, String value) {
        String escaped = value.toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return cb.like(cb.lower(field), "%" + escaped + "%", '\\');
    }
}
