package com.devjob.notification;

import java.time.Instant;

public record NotificationDto(long id, NotificationType type, long sourceId, Instant scheduledAt,
        String subject, Instant createdAt, Instant readAt) { }
