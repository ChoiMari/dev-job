package com.devjob.notification;

import static org.assertj.core.api.Assertions.assertThatCode;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/** Read-only SQL smoke test against a migrated local database. */
@EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_(live|b13_test)")
@Tag("database")
@SpringBootTest
class ExtendedNotificationRepositoryDatabaseTest {
    @Autowired ExtendedNotificationRepository repository;

    @Test void everyExpandedEventQueryExecutes() {
        for (NotificationType type : NotificationType.values()) {
            if (type == NotificationType.INTERVIEW_REMINDER || type == NotificationType.TODO_REMINDER) continue;
            if (type == NotificationType.LEARNING_GOAL_REMINDER)
                assertThatCode(repository::pendingLearningGoals).as(type.name()).doesNotThrowAnyException();
            else
                assertThatCode(() -> repository.forEvent(new ExtendedNotificationRepository.Outbox(
                        0, type, -1, java.time.Instant.now()))).as(type.name()).doesNotThrowAnyException();
        }
    }
}
