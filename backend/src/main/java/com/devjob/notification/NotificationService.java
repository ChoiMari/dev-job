package com.devjob.notification;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

@Service
public class NotificationService {
    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
    private static final Map<String, NotificationType> PREFERENCE_TYPES = Map.ofEntries(
            Map.entry("interviewReminder", NotificationType.INTERVIEW_REMINDER),
            Map.entry("todoReminder", NotificationType.TODO_REMINDER),
            Map.entry("newJob", NotificationType.NEW_JOB),
            Map.entry("aiJobRecommendation", NotificationType.AI_JOB_RECOMMENDATION),
            Map.entry("savedJobUpdate", NotificationType.SAVED_JOB_UPDATE),
            Map.entry("documentAnalysis", NotificationType.DOCUMENT_ANALYSIS),
            Map.entry("matchAnalysis", NotificationType.MATCH_ANALYSIS),
            Map.entry("semanticRecommendation", NotificationType.SEMANTIC_RECOMMENDATION),
            Map.entry("learningGoalReminder", NotificationType.LEARNING_GOAL_REMINDER),
            Map.entry("characterActivity", NotificationType.CHARACTER_ACTIVITY),
            Map.entry("serviceNotice", NotificationType.SERVICE_NOTICE));
    private final NotificationRepository repository;
    private final ExtendedNotificationRepository expanded;
    private final TransactionTemplate transaction;

    public NotificationService(NotificationRepository repository, ExtendedNotificationRepository expanded,
            org.springframework.transaction.PlatformTransactionManager manager) {
        this.repository = repository;
        this.expanded = expanded;
        this.transaction = new TransactionTemplate(manager);
        this.transaction.setPropagationBehavior(
                org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @Transactional(readOnly = true)
    public NotificationPreferences preferences(long userId) {
        return new NotificationPreferences(
                repository.enabled(userId, NotificationType.INTERVIEW_REMINDER),
                repository.enabled(userId, NotificationType.TODO_REMINDER),
                repository.enabled(userId, NotificationType.NEW_JOB),
                repository.enabled(userId, NotificationType.AI_JOB_RECOMMENDATION),
                repository.enabled(userId, NotificationType.SAVED_JOB_UPDATE),
                repository.enabled(userId, NotificationType.DOCUMENT_ANALYSIS),
                repository.enabled(userId, NotificationType.MATCH_ANALYSIS),
                repository.enabled(userId, NotificationType.SEMANTIC_RECOMMENDATION),
                repository.enabled(userId, NotificationType.LEARNING_GOAL_REMINDER),
                repository.enabled(userId, NotificationType.CHARACTER_ACTIVITY),
                repository.enabled(userId, NotificationType.SERVICE_NOTICE));
    }

    @Transactional
    public NotificationPreferences savePreferences(long userId, JsonNode input) {
        if (input == null || !input.isObject()
                || !input.has("interviewReminder") || !input.has("todoReminder")
                || !input.get("interviewReminder").isBoolean() || !input.get("todoReminder").isBoolean()) {
            throw badInput();
        }
        input.fields().forEachRemaining(field -> {
            NotificationType type = PREFERENCE_TYPES.get(field.getKey());
            if (type == null || !field.getValue().isBoolean()) throw badInput();
        });
        input.fields().forEachRemaining(field -> {
            NotificationType type = PREFERENCE_TYPES.get(field.getKey());
            repository.savePreference(userId, type, field.getValue().booleanValue());
        });
        return preferences(userId);
    }

    @Transactional(readOnly = true)
    public NotificationPage list(long userId, int page, int size) {
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE) throw badInput();
        var counts = repository.counts(userId);
        return new NotificationPage(repository.list(userId, size, (long) page * size), page, size,
                counts.total(), counts.unread());
    }

    @Transactional
    public void markRead(long userId, long id) {
        if (id < 1) throw badInput();
        if (!repository.markRead(userId, id)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    }

    @Scheduled(fixedDelay = 60000)
    public void deliverDue() {
        try {
            Instant end = Instant.now().plus(Duration.ofHours(24));
            for (var candidate : repository.dueInterviews(end)) {
                attempt(NotificationType.INTERVIEW_REMINDER, candidate);
            }
            for (var candidate : repository.dueTodos(end)) {
                attempt(NotificationType.TODO_REMINDER, candidate);
            }
        } catch (RuntimeException failure) {
            log.warn("Notification scan failed; next scan will retry", failure);
        }
        try {
            for (var event : expanded.pendingLearningGoals()) {
                try {
                    transaction.executeWithoutResult(status -> {
                        if (repository.enabled(event.userId(), NotificationType.LEARNING_GOAL_REMINDER))
                            repository.create(event.userId(), NotificationType.LEARNING_GOAL_REMINDER, event);
                    });
                } catch (RuntimeException failure) {
                    log.warn("Learning goal reminder {} will be retried", event.id(), failure);
                }
            }
        } catch (RuntimeException failure) {
            log.warn("Learning goal reminder scan failed", failure);
        }
        try {
            for (long id : expanded.pendingOutboxIds()) {
                try { dispatch(id); }
                catch (RuntimeException failure) {
                    log.warn("Notification outbox event {} will be retried", id, failure);
                }
            }
        } catch (RuntimeException failure) {
            log.warn("Notification outbox scan failed", failure);
        }
    }

    public void dispatch(long outboxId) {
        transaction.executeWithoutResult(status -> {
            var event = expanded.lockOutbox(outboxId);
            if (event == null) return;
            for (var recipient : expanded.forEvent(event)) {
                if (repository.enabled(recipient.userId(), event.type()))
                    repository.create(recipient.userId(), event.type(), recipient);
            }
            expanded.markProcessed(outboxId);
        });
    }

    private void attempt(NotificationType type, NotificationRepository.Candidate candidate) {
        try {
            transaction.executeWithoutResult(status -> {
                var current = repository.lockCurrent(type, candidate.id(), Instant.now().plus(Duration.ofHours(24)));
                if (current != null && current.userId() == candidate.userId()
                        && repository.enabled(current.userId(), type)) {
                    repository.create(current.userId(), type, current);
                }
            });
        } catch (RuntimeException failure) {
            log.warn("Notification delivery failed for {} {}. Next scan will retry", type, candidate.id(), failure);
        }
    }

    private static ResponseStatusException badInput() { return new ResponseStatusException(HttpStatus.BAD_REQUEST); }
}
