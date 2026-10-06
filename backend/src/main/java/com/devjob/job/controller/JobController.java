package com.devjob.job.controller;

import com.devjob.job.dto.*;
import com.devjob.job.service.JobQueryService;
import com.devjob.job.service.JobMatchService;
import com.devjob.auth.dto.CurrentUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/jobs")
public class JobController {
    private final JobQueryService jobs;
    private final JobMatchService matches;
    public JobController(JobQueryService jobs, JobMatchService matches) { this.jobs = jobs; this.matches = matches; }
    @GetMapping
    public JobPage search(@AuthenticationPrincipal CurrentUser user, @ModelAttribute JobQuery query) { return jobs.search(user.id(), query); }
    @GetMapping("/{jobId}")
    public JobDetail detail(@AuthenticationPrincipal CurrentUser user, @PathVariable long jobId) { return jobs.detail(user.id(), jobId); }
    @GetMapping("/{jobId}/match")
    public JobMatch match(@AuthenticationPrincipal CurrentUser user, @PathVariable long jobId) { return matches.match(user.id(), jobId); }
}
