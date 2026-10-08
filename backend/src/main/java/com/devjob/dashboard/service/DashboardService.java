package com.devjob.dashboard.service;

import com.devjob.analysis.service.SkillGapService;
import com.devjob.application.entity.ApplicationStatus;
import com.devjob.application.repository.ApplicationRepository;
import com.devjob.bookmark.repository.BookmarkRepository;
import com.devjob.dashboard.dto.Dashboard;
import com.devjob.job.dto.JobSummary;
import com.devjob.job.entity.JobPosting;
import com.devjob.job.repository.JobMatchQueryRepository;
import com.devjob.job.repository.JobPostingRepository;
import com.devjob.savedjob.repository.PersonalSavedJobRepository;
import com.devjob.todo.dto.TodoResponse;
import com.devjob.todo.repository.PersonalTodoRepository;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Set;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class DashboardService {
    private static final List<ApplicationStatus> ACTION_STATUSES = List.of(ApplicationStatus.INTERESTED,
            ApplicationStatus.PLANNED, ApplicationStatus.APPLIED, ApplicationStatus.DOCUMENT_PASSED,
            ApplicationStatus.INTERVIEW);
    private final ApplicationRepository applications;
    private final BookmarkRepository bookmarks;
    private final PersonalSavedJobRepository personalJobs;
    private final JobPostingRepository jobs;
    private final JobMatchQueryRepository matches;
    private final SkillGapService skillGaps;
    private final PersonalTodoRepository todos;

    public DashboardService(ApplicationRepository applications, BookmarkRepository bookmarks,
            PersonalSavedJobRepository personalJobs, JobPostingRepository jobs, JobMatchQueryRepository matches,
            SkillGapService skillGaps, PersonalTodoRepository todos) {
        this.applications = applications; this.bookmarks = bookmarks; this.jobs = jobs;
        this.personalJobs = personalJobs; this.matches = matches; this.skillGaps = skillGaps; this.todos = todos;
    }

    public Dashboard get(Long userId) {
        var counts = new EnumMap<ApplicationStatus, Long>(ApplicationStatus.class);
        for (var status : ApplicationStatus.values()) counts.put(status, 0L);
        for (var row : applications.countByStatus(userId)) counts.put((ApplicationStatus) row[0], (Long) row[1]);

        var actions = applications.findNextActions(userId, ACTION_STATUSES, PageRequest.of(0, 5)).stream()
                .map(a -> new Dashboard.NextAction(a.getId(), a.getJob() == null ? null : a.getJob().getId(),
                        a.getJob() == null ? a.getPersonalSavedJob().getTitle() : a.getJob().getTitle(),
                        a.getCurrentStatus(), a.getNextScheduleAt()))
                .toList();

        var ids = matches.recommendedJobIds(userId, LocalDate.now(ZoneId.of("Asia/Seoul")), 3);
        var recommended = List.<JobSummary>of();
        if (!ids.isEmpty()) {
            var byId = new HashMap<Long, JobPosting>();
            jobs.findAllById(ids).forEach(job -> byId.put(job.getId(), job));
            var rates = matches.ratesForJobs(userId, ids);
            var saved = Set.copyOf(bookmarks.findSavedJobIds(userId, ids));
            recommended = ids.stream().map(id -> JobSummary.from(byId.get(id), saved.contains(id), null, rates.get(id))).toList();
        }

        var gap = skillGaps.find(userId, null);
        var preview = gap.available() ? gap.items().stream().map(item -> item.skill()).toList() : List.<com.devjob.skill.dto.SkillResponse>of();
        return new Dashboard(counts, bookmarks.countByUserId(userId) + personalJobs.countByUserIdAndDeletedAtIsNull(userId),
                actions, recommended, preview, todos.dashboard(userId, PageRequest.of(0, 5)).stream().map(TodoResponse::from).toList());
    }
}
