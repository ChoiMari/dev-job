package com.devjob.notification;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class NotificationRepository {
    private final JdbcTemplate jdbc;
    public NotificationRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record Candidate(long id, long userId) { }
    public record DueEvent(long id, long userId, Instant at, String subject) { }

    public List<Candidate> dueInterviews(Instant end) {
        return jdbc.query("select id, user_id from interview_schedule where cancelled_at is null "
                + "and starts_at > current_timestamp and starts_at <= ? order by starts_at, id",
                (rs, row) -> new Candidate(rs.getLong(1), rs.getLong(2)), Timestamp.from(end));
    }
    public List<Candidate> dueTodos(Instant end) {
        return jdbc.query("select id, user_id from personal_todo where deleted_at is null and completed_at is null "
                + "and reminder_minutes >= 0 and due_at > current_timestamp and due_at <= ? "
                + "and due_at - reminder_minutes * interval '1 minute' <= current_timestamp order by due_at, id",
                (rs, row) -> new Candidate(rs.getLong(1), rs.getLong(2)), Timestamp.from(end));
    }
    public DueEvent lockCurrent(NotificationType type, long id, Instant end) {
        String sql = type == NotificationType.INTERVIEW_REMINDER
                ? "select id, user_id, starts_at, title from interview_schedule where id=? "
                    + "and cancelled_at is null and starts_at > current_timestamp and starts_at <= ? for update"
                : "select id, user_id, due_at, title from personal_todo where id=? "
                    + "and deleted_at is null and completed_at is null and reminder_minutes >= 0 "
                    + "and due_at > current_timestamp and due_at <= ? "
                    + "and due_at - reminder_minutes * interval '1 minute' <= current_timestamp for update";
        return jdbc.query(sql, rs -> rs.next() ? new DueEvent(rs.getLong(1), rs.getLong(2),
                rs.getTimestamp(3).toInstant(), rs.getString(4)) : null, id, Timestamp.from(end));
    }
    public boolean enabled(long userId, NotificationType type) {
        Boolean stored = jdbc.query("select enabled from notification_preference where user_id=? and type=?",
                rs -> rs.next() ? rs.getBoolean(1) : null, userId, type.name());
        return stored == null ? type != NotificationType.SAVED_JOB_UPDATE
                && type != NotificationType.SEMANTIC_RECOMMENDATION
                && type != NotificationType.SERVICE_NOTICE : stored;
    }
    public void savePreference(long userId, NotificationType type, boolean enabled) {
        jdbc.update("insert into notification_preference(user_id,type,enabled,changed_at) "
                + "values (?,?,?,current_timestamp) on conflict (user_id,type) "
                + "do update set enabled=excluded.enabled,changed_at=case "
                + "when notification_preference.enabled is distinct from excluded.enabled "
                + "then current_timestamp else notification_preference.changed_at end",
                userId, type.name(), enabled);
    }
    public void create(long userId, NotificationType type, DueEvent event) {
        jdbc.update("insert into notification(user_id,type,source_id,scheduled_at,subject,created_at) "
                + "values (?,?,?,?,?,current_timestamp) on conflict on constraint uq_notification_event do nothing",
                userId, type.name(), event.id(), Timestamp.from(event.at()), event.subject());
    }
    public long count(long userId) {
        return jdbc.queryForObject("select count(*) from notification where user_id=?", Long.class, userId);
    }
    public List<NotificationDto> list(long userId, int size, long offset) {
        return jdbc.query("select id,type,source_id,scheduled_at,subject,created_at,read_at "
                + "from notification where user_id=? order by created_at desc,id desc limit ? offset ?",
                (rs, row) -> new NotificationDto(rs.getLong(1), NotificationType.valueOf(rs.getString(2)),
                        rs.getLong(3), rs.getTimestamp(4).toInstant(), rs.getString(5),
                        rs.getTimestamp(6).toInstant(), rs.getTimestamp(7) == null
                                ? null : rs.getTimestamp(7).toInstant()), userId, size, offset);
    }
    public boolean markRead(long userId, long id) {
        return jdbc.update("update notification set read_at=coalesce(read_at,current_timestamp) "
                + "where id=? and user_id=?", id, userId) == 1;
    }
}
