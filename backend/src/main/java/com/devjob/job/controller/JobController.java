package com.devjob.job.controller;

import com.devjob.job.dto.*;
import com.devjob.job.service.JobQueryService;
import com.devjob.job.service.JobMatchService;
import com.devjob.job.service.JobCollectionService;
import com.devjob.job.service.JobCollectionResult;
import com.devjob.job.adapter.JobSearchCondition;
import com.devjob.job.adapter.alio.AlioAdapter;
import com.devjob.auth.dto.CurrentUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/jobs")
public class JobController {
    private final JobQueryService jobs;
    private final JobMatchService matches;
    private final JobCollectionService collection;
    private final AlioAdapter alio;
    public JobController(JobQueryService jobs, JobMatchService matches, JobCollectionService collection, AlioAdapter alio) {
        this.jobs = jobs; this.matches = matches; this.collection = collection; this.alio = alio;
    }
    @GetMapping
    public JobPage search(@AuthenticationPrincipal CurrentUser user, @ModelAttribute JobQuery query) { return jobs.search(user.id(), query); }
    @GetMapping("/{jobId}")
    public JobDetail detail(@AuthenticationPrincipal CurrentUser user, @PathVariable long jobId) { return jobs.detail(user.id(), jobId); }
    @GetMapping("/{jobId}/match")
    public JobMatch match(@AuthenticationPrincipal CurrentUser user, @PathVariable long jobId) { return matches.match(user.id(), jobId); }
    /** Internal collection endpoint; never called by the user job list. */
    @PostMapping("/collections/alio")
    public JobCollectionResult collectAlio(@AuthenticationPrincipal CurrentUser user,
            @RequestParam(required = false) String keyword, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "3") int pages) {
        if (page < 0 || page > 999 || pages < 1 || pages > 3 || page + pages > 1000
                || (keyword != null && keyword.strip().length() > 100))
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST);
        return collection.collect(alio, new JobSearchCondition(keyword, page, 20, pages));
    }
}
