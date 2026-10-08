package com.devjob.dashboard;

import com.devjob.analysis.dto.SkillGap;
import com.devjob.analysis.service.SkillGapService;
import com.devjob.application.entity.Application;
import com.devjob.application.entity.ApplicationStatus;
import com.devjob.application.repository.ApplicationRepository;
import com.devjob.bookmark.repository.BookmarkRepository;
import com.devjob.dashboard.service.DashboardService;
import com.devjob.job.repository.JobMatchQueryRepository;
import com.devjob.job.repository.JobPostingRepository;
import com.devjob.savedjob.repository.PersonalSavedJobRepository;
import com.devjob.todo.repository.PersonalTodoRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DashboardServiceTest {
    private final ApplicationRepository applications = mock(ApplicationRepository.class);
    private final BookmarkRepository bookmarks = mock(BookmarkRepository.class);
    private final PersonalSavedJobRepository personalJobs = mock(PersonalSavedJobRepository.class);
    private final JobPostingRepository jobs = mock(JobPostingRepository.class);
    private final JobMatchQueryRepository matches = mock(JobMatchQueryRepository.class);
    private final SkillGapService gaps = mock(SkillGapService.class);
    private final PersonalTodoRepository todos = mock(PersonalTodoRepository.class);
    private final DashboardService service = new DashboardService(applications, bookmarks, personalJobs, jobs, matches, gaps, todos);

    @Test void emptyDashboardHasZeroCountsAndNoExternalCalls() {
        when(applications.countByStatus(7L)).thenReturn(List.of());
        when(applications.findNextActions(eq(7L), anyCollection(), any(Pageable.class))).thenReturn(List.of());
        when(matches.recommendedJobIds(eq(7L), any(LocalDate.class), eq(3))).thenReturn(List.of());
        when(gaps.find(7L, null)).thenReturn(SkillGap.unavailable(null, 0, "USER_SKILLS_EMPTY"));
        when(todos.dashboard(eq(7L), any(Pageable.class))).thenReturn(List.of());

        var result = service.get(7L);
        assertThat(result.applicationCounts()).hasSize(ApplicationStatus.values().length).containsEntry(ApplicationStatus.PLANNED, 0L);
        assertThat(result.bookmarkCount()).isZero();
        assertThat(result.nextActions()).isEmpty();
        assertThat(result.recommendedJobs()).isEmpty();
        assertThat(result.skillGapPreview()).isEmpty();
        assertThat(result.personalTodos()).isEmpty();
        verifyNoInteractions(jobs);
    }

    @Test void countsAndActionsUseTheAuthenticatedUser() {
        var application = mock(Application.class);
        var job = mock(com.devjob.job.entity.JobPosting.class);
        when(application.getId()).thenReturn(9L);
        when(application.getJob()).thenReturn(job);
        when(application.getCurrentStatus()).thenReturn(ApplicationStatus.INTERVIEW);
        when(application.getNextScheduleAt()).thenReturn(Instant.parse("2026-10-10T05:00:00Z"));
        when(job.getId()).thenReturn(15L);
        when(job.getTitle()).thenReturn("면접 공고");
        when(applications.countByStatus(7L)).thenReturn(List.<Object[]>of(new Object[]{ApplicationStatus.INTERVIEW, 2L}));
        when(applications.findNextActions(eq(7L), anyCollection(), any(Pageable.class))).thenReturn(List.of(application));
        when(bookmarks.countByUserId(7L)).thenReturn(4L);
        when(matches.recommendedJobIds(eq(7L), any(LocalDate.class), eq(3))).thenReturn(List.of());
        when(gaps.find(7L, null)).thenReturn(SkillGap.unavailable(null, 0, "INSUFFICIENT_SAMPLE"));
        when(todos.dashboard(eq(7L), any(Pageable.class))).thenReturn(List.of());

        var result = service.get(7L);
        assertThat(result.applicationCounts()).containsEntry(ApplicationStatus.INTERVIEW, 2L)
                .containsEntry(ApplicationStatus.APPLIED, 0L);
        assertThat(result.bookmarkCount()).isEqualTo(4);
        assertThat(result.nextActions()).singleElement().satisfies(action -> {
            assertThat(action.applicationId()).isEqualTo(9L);
            assertThat(action.jobTitle()).isEqualTo("면접 공고");
        });
        verify(applications).countByStatus(7L);
        verify(bookmarks).countByUserId(7L);
        verify(matches).recommendedJobIds(eq(7L), any(LocalDate.class), eq(3));
        verify(gaps).find(7L, null);
    }
}
