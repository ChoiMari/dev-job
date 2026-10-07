package com.devjob.application.service;

import com.devjob.application.dto.*;
import com.devjob.application.entity.*;
import com.devjob.application.repository.*;
import com.devjob.job.repository.JobPostingRepository;
import com.devjob.savedjob.repository.PersonalSavedJobRepository;
import com.devjob.user.repository.UserRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class ApplicationService {
    private final ApplicationRepository applications;
    private final ApplicationStatusHistoryRepository histories;
    private final UserRepository users;
    private final JobPostingRepository jobs;
    private final PersonalSavedJobRepository personalJobs;
    public ApplicationService(ApplicationRepository applications, ApplicationStatusHistoryRepository histories,
            UserRepository users, JobPostingRepository jobs, PersonalSavedJobRepository personalJobs) {
        this.applications = applications; this.histories = histories; this.users = users; this.jobs = jobs;
        this.personalJobs = personalJobs;
    }
    public ApplicationResponse.Page list(Long userId, String status, int page, int size) {
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE) fail(HttpStatus.BAD_REQUEST);
        ApplicationStatus parsed = parseStatus(status);
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
        var result = parsed == null ? applications.findByUserId(userId, pageable)
                : applications.findByUserIdAndCurrentStatus(userId, parsed, pageable);
        return new ApplicationResponse.Page(result.getContent().stream().map(ApplicationResponse::from).toList(), page, size, result.getTotalElements());
    }
    public static ApplicationStatus parseStatus(String value) {
        if (value == null) return null;
        try { return ApplicationStatus.valueOf(value); }
        catch (IllegalArgumentException exception) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST); }
    }
    public ApplicationResponse detail(Long userId, long id) { return ApplicationResponse.from(owned(userId, id, false)); }
    public List<ApplicationResponse.History> history(Long userId, long id) {
        owned(userId, id, false);
        return histories.findByApplicationIdOrderByChangedAtAscIdAsc(id).stream().map(ApplicationResponse.History::from).toList();
    }
    @Transactional
    public ApplicationResponse create(Long userId, ApplicationInput.Create input) {
        if (!input.status().canStart()) fail(HttpStatus.BAD_REQUEST);
        validateAppliedDate(input.status(), input.appliedDate());
        var user = users.findById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if ((input.jobId() == null) == (input.personalSavedJobId() == null)) fail(HttpStatus.BAD_REQUEST);
        var job = input.jobId() == null ? null : jobs.findById(input.jobId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        var personalJob = input.personalSavedJobId() == null ? null : personalJobs
                .findByIdAndUserIdAndDeletedAtIsNull(input.personalSavedJobId(), userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (job != null && applications.existsByUserIdAndJobId(userId, job.getId())) fail(HttpStatus.CONFLICT);
        if (personalJob != null && applications.existsByUserIdAndPersonalSavedJobId(userId, personalJob.getId())) fail(HttpStatus.CONFLICT);
        try {
            var application = applications.saveAndFlush(job == null
                    ? new Application(user, personalJob, input.status(), input.appliedDate(), input.note(), input.nextScheduleAt())
                    : new Application(user, job, input.status(), input.appliedDate(), input.note(), input.nextScheduleAt()));
            histories.saveAndFlush(new ApplicationStatusHistory(application, null, input.status(), application.getCreatedAt()));
            return ApplicationResponse.from(application);
        } catch (DataIntegrityViolationException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT);
        }
    }
    @Transactional
    public ApplicationResponse update(Long userId, long id, ApplicationInput.Update input) {
        var application = owned(userId, id, true);
        application.update(input.noteProvided(), input.note(), input.scheduleProvided(), input.nextScheduleAt());
        applications.flush();
        return ApplicationResponse.from(application);
    }
    @Transactional
    public ApplicationResponse changeStatus(Long userId, long id, ApplicationInput.ChangeStatus input) {
        var application = owned(userId, id, true);
        if (!application.getCurrentStatus().canTransitionTo(input.status())) fail(HttpStatus.CONFLICT);
        validateAppliedDate(input.status(), input.appliedDate());
        var previous = application.getCurrentStatus();
        var changedAt = Instant.now();
        application.transition(input.status(), input.appliedDate(), changedAt);
        histories.saveAndFlush(new ApplicationStatusHistory(application, previous, input.status(), changedAt));
        applications.flush();
        return ApplicationResponse.from(application);
    }
    private Application owned(Long userId, long id, boolean lock) {
        if (id < 1) fail(HttpStatus.BAD_REQUEST);
        var application = (lock ? applications.findForUpdate(id) : applications.findById(id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (!application.getUser().getId().equals(userId)) fail(HttpStatus.FORBIDDEN);
        return application;
    }
    private void validateAppliedDate(ApplicationStatus status, LocalDate date) {
        if ((status == ApplicationStatus.APPLIED) != (date != null)) fail(HttpStatus.BAD_REQUEST);
    }
    private static void fail(HttpStatus status) { throw new ResponseStatusException(status); }
}
