package com.devjob.notification;

import com.devjob.auth.dto.CurrentUser;
import java.time.Instant;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ServiceNoticeService {
    public record Notice(long id, String title, Instant publishedAt) { }
    private final JdbcTemplate jdbc;
    private final Set<String> administrators;
    private final NotificationEventRecorder notifications;

    public ServiceNoticeService(JdbcTemplate jdbc, NotificationEventRecorder notifications,
            @Value("${ALIO_BATCH_ADMIN_EMAILS:}") String adminEmails) {
        this.jdbc = jdbc;
        this.notifications = notifications;
        this.administrators = Arrays.stream(adminEmails.split(","))
                .map(value -> value.strip().toLowerCase(Locale.ROOT)).filter(value -> !value.isEmpty())
                .collect(Collectors.toUnmodifiableSet());
    }

    @Transactional
    public Notice publish(CurrentUser user, String title) {
        if (user == null || user.email() == null
                || !administrators.contains(user.email().toLowerCase(Locale.ROOT)))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        if (title == null || title.isBlank() || title.strip().length() > 200
                || title.codePoints().anyMatch(Character::isISOControl))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        String clean = title.strip();
        Notice notice = jdbc.queryForObject("insert into service_notice(published_by,title) values (?,?) "
                + "returning id,title,published_at", (rs, row) -> new Notice(rs.getLong(1),
                rs.getString(2), rs.getTimestamp(3).toInstant()), user.id(), clean);
        notifications.record(NotificationType.SERVICE_NOTICE, notice.id(), notice.publishedAt());
        return notice;
    }
}
