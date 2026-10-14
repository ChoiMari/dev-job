package com.devjob.notification;

import java.sql.Timestamp;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** Records the domain event atomically and dispatches it after the business transaction commits. */
@Component
public class NotificationEventRecorder {
    private static final Logger log = LoggerFactory.getLogger(NotificationEventRecorder.class);
    private final JdbcTemplate jdbc;
    private final NotificationService notifications;

    public NotificationEventRecorder(JdbcTemplate jdbc, NotificationService notifications) {
        this.jdbc = jdbc;
        this.notifications = notifications;
    }

    public void record(NotificationType type, long sourceId, Instant occurredAt) {
        if (!TransactionSynchronizationManager.isActualTransactionActive()
                || !TransactionSynchronizationManager.isSynchronizationActive())
            throw new IllegalStateException("Notification event requires a transaction");
        Long id = jdbc.query("insert into notification_outbox(type,source_id,occurred_at) "
                + "values (?,?,?) on conflict (type,source_id,occurred_at) do nothing returning id",
                rs -> rs.next() ? rs.getLong(1) : null,
                type.name(), sourceId, Timestamp.from(occurredAt));
        if (id == null) return;
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() {
                try { notifications.dispatch(id); }
                catch (RuntimeException failure) {
                    log.warn("Notification event {} will be retried by the scheduler", id, failure);
                }
            }
        });
    }
}
