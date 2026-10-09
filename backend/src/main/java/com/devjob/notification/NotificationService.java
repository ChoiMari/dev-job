package com.devjob.notification;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.time.Instant;
import java.util.Set;
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
    private static final Set<String> PREFERENCE_FIELDS = Set.of("interviewReminder", "todoReminder");
    private final NotificationRepository repository;
    private final TransactionTemplate transaction;

    public NotificationService(NotificationRepository repository,
            org.springframework.transaction.PlatformTransactionManager manager) {
        this.repository = repository;
        this.transaction = new TransactionTemplate(manager);
        this.transaction.setPropagationBehavior(
                org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @Transactional(readOnly = true)
    public NotificationPreferences preferences(long userId) {
        return new NotificationPreferences(repository.enabled(userId, NotificationType.INTERVIEW_REMINDER),
                repository.enabled(userId, NotificationType.TODO_REMINDER));
    }

    @Transactional
    public NotificationPreferences savePreferences(long userId, JsonNode input) {
        if (input == null || !input.isObject() || input.size() != 2
                || !input.has("interviewReminder") || !input.has("todoReminder")
                || !input.get("interviewReminder").isBoolean() || !input.get("todoReminder").isBoolean()) {
            throw badInput();
        }
        input.fieldNames().forEachRemaining(name -> { if (!PREFERENCE_FIELDS.contains(name)) throw badInput(); });
        boolean interview = input.get("interviewReminder").booleanValue();
        boolean todo = input.get("todoReminder").booleanValue();
        repository.savePreference(userId, NotificationType.INTERVIEW_REMINDER, interview);
        repository.savePreference(userId, NotificationType.TODO_REMINDER, todo);
        return new NotificationPreferences(interview, todo);
    }

    @Transactional(readOnly = true)
    public NotificationPage list(long userId, int page, int size) {
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE) throw badInput();
        return new NotificationPage(repository.list(userId, size, (long) page * size), page, size,
                repository.count(userId));
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
