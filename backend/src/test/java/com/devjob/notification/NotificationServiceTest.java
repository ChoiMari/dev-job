package com.devjob.notification;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class NotificationServiceTest {
    NotificationRepository repository;
    ExtendedNotificationRepository expanded;
    NotificationService service;
    PlatformTransactionManager manager;

    @BeforeEach void setup() {
        repository = mock(NotificationRepository.class);
        expanded = mock(ExtendedNotificationRepository.class);
        manager = mock(PlatformTransactionManager.class);
        when(manager.getTransaction(any())).thenReturn(mock(TransactionStatus.class));
        service = new NotificationService(repository, expanded, manager);
    }

    @Test void defaultPreferencesAndStrictWholeUpdate() throws Exception {
        when(repository.enabled(7L, NotificationType.INTERVIEW_REMINDER)).thenReturn(true);
        when(repository.enabled(7L, NotificationType.TODO_REMINDER)).thenReturn(true);
        assertThat(service.preferences(7L).interviewReminder()).isTrue();
        assertThat(service.preferences(7L).todoReminder()).isTrue();
        var json = new ObjectMapper();
        assertThatThrownBy(() -> service.savePreferences(7L,
                json.readTree("{\"interviewReminder\":false}")))
                .isInstanceOf(ResponseStatusException.class);
        verify(repository, never()).savePreference(anyLong(), any(), anyBoolean());
        assertThatThrownBy(() -> service.savePreferences(7L,
                json.readTree("{\"interviewReminder\":true,\"todoReminder\":true,\"unknown\":false}")))
                .isInstanceOf(ResponseStatusException.class);
        service.savePreferences(7L, json.readTree(
                "{\"interviewReminder\":false,\"todoReminder\":true,\"newJob\":false}"));
        verify(repository).savePreference(7L, NotificationType.INTERVIEW_REMINDER, false);
        verify(repository).savePreference(7L, NotificationType.TODO_REMINDER, true);
        verify(repository).savePreference(7L, NotificationType.NEW_JOB, false);
    }

    @Test void optedOutAndFailedEventDoNotBlockOtherCandidates() {
        Instant due = Instant.now().plusSeconds(3600);
        var first = new NotificationRepository.Candidate(1, 7);
        var second = new NotificationRepository.Candidate(2, 8);
        var third = new NotificationRepository.Candidate(3, 9);
        when(repository.dueInterviews(any())).thenReturn(List.of(first, second, third));
        when(repository.dueTodos(any())).thenReturn(List.of());
        when(repository.lockCurrent(eq(NotificationType.INTERVIEW_REMINDER), eq(1L), any()))
                .thenReturn(new NotificationRepository.DueEvent(1, 7, due, "Opted out"));
        when(repository.lockCurrent(eq(NotificationType.INTERVIEW_REMINDER), eq(2L), any()))
                .thenReturn(new NotificationRepository.DueEvent(2, 8, due, "Fails"));
        when(repository.lockCurrent(eq(NotificationType.INTERVIEW_REMINDER), eq(3L), any()))
                .thenReturn(new NotificationRepository.DueEvent(3, 9, due, "Works"));
        when(repository.enabled(7, NotificationType.INTERVIEW_REMINDER)).thenReturn(false);
        when(repository.enabled(8, NotificationType.INTERVIEW_REMINDER)).thenReturn(true);
        when(repository.enabled(9, NotificationType.INTERVIEW_REMINDER)).thenReturn(true);
        doThrow(new IllegalStateException("temporary failure")).when(repository).create(eq(8L), any(), any());

        assertThatCode(service::deliverDue).doesNotThrowAnyException();
        verify(repository, never()).create(eq(7L), any(), any());
        verify(repository).create(eq(9L), eq(NotificationType.INTERVIEW_REMINDER), any());
        verify(manager, times(3)).getTransaction(any());
    }

    @Test void expandedEventIsDeliveredOnceAndRespectsPreference() {
        var event = new NotificationRepository.DueEvent(18, 7, Instant.now(), "새 공고");
        var outbox = new ExtendedNotificationRepository.Outbox(4, NotificationType.NEW_JOB, 18, event.at());
        when(expanded.pendingOutboxIds()).thenReturn(List.of(4L));
        when(expanded.lockOutbox(4)).thenReturn(outbox, (ExtendedNotificationRepository.Outbox) null);
        when(expanded.forEvent(outbox)).thenReturn(List.of(event));
        when(repository.enabled(7, NotificationType.NEW_JOB)).thenReturn(true);
        service.deliverDue();
        service.deliverDue();
        verify(repository, times(1)).create(7, NotificationType.NEW_JOB, event);
        verify(expanded).markProcessed(4);
    }

    @Test void readIsOwnerScopedAndIdempotentAtServiceBoundary() {
        when(repository.markRead(7, 3)).thenReturn(true);
        assertThatCode(() -> { service.markRead(7, 3); service.markRead(7, 3); })
                .doesNotThrowAnyException();
        assertThatThrownBy(() -> service.markRead(8, 3))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("404");
        verify(repository, times(2)).markRead(7, 3);
    }
    @Test void failedCreationIsRetriedOnNextScan() {
        Instant due = Instant.now().plusSeconds(3600);
        var candidate = new NotificationRepository.Candidate(12, 7);
        when(repository.dueInterviews(any())).thenReturn(List.of(candidate));
        when(repository.dueTodos(any())).thenReturn(List.of());
        when(repository.lockCurrent(eq(NotificationType.INTERVIEW_REMINDER), eq(12L), any()))
                .thenReturn(new NotificationRepository.DueEvent(12, 7, due, "Retry"));
        when(repository.enabled(7, NotificationType.INTERVIEW_REMINDER)).thenReturn(true);
        doThrow(new IllegalStateException("temporary")).doNothing().when(repository)
                .create(eq(7L), eq(NotificationType.INTERVIEW_REMINDER), any());
        service.deliverDue();
        service.deliverDue();
        verify(repository, times(2)).create(eq(7L), eq(NotificationType.INTERVIEW_REMINDER), any());
    }}
