package com.devjob.notification;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/** Reads committed business events; notification creation is retried separately. */
@Repository
public class ExtendedNotificationRepository {
    private final JdbcTemplate jdbc;
    public ExtendedNotificationRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public record Outbox(long id, NotificationType type, long sourceId, Instant occurredAt) { }

    public List<Long> pendingOutboxIds() {
        return jdbc.query("select id from notification_outbox where processed_at is null order by id limit 200",
                (rs, row) -> rs.getLong(1));
    }

    public Outbox lockOutbox(long id) {
        return jdbc.query("select id,type,source_id,occurred_at from notification_outbox "
                + "where id=? and processed_at is null for update skip locked",
                rs -> rs.next() ? new Outbox(rs.getLong(1), NotificationType.valueOf(rs.getString(2)),
                        rs.getLong(3), rs.getTimestamp(4).toInstant()) : null, id);
    }

    public void markProcessed(long id) {
        jdbc.update("update notification_outbox set processed_at=current_timestamp where id=?", id);
    }

    public List<NotificationRepository.DueEvent> pendingLearningGoals() {
        return candidates(NotificationType.LEARNING_GOAL_REMINDER, null, null);
    }

    public List<NotificationRepository.DueEvent> forEvent(Outbox outbox) {
        return candidates(outbox.type(), outbox.sourceId(), outbox.occurredAt());
    }

    private List<NotificationRepository.DueEvent> candidates(NotificationType type, Long sourceId, Instant occurredAt) {
        String events = switch (type) {
            case NEW_JOB -> """
                    with owned as (
                      select us.user_id,s.normalized_name as skill from user_skill us
                        join skill s on s.id=us.skill_id
                      union select p.user_id,s.normalized_name from project_skill ps
                        join project p on p.id=ps.project_id join skill s on s.id=ps.skill_id
                      union select user_id,normalized_name from user_custom_skill
                    )
                    select distinct o.user_id, j.id as source_id, j.created_at as scheduled_at,
                      left('새 채용공고: ' || j.title, 200) as subject
                    from job_posting j join job_skill js on js.job_posting_id=j.id
                    join skill s on s.id=js.skill_id join owned o on o.skill=s.normalized_name
                    join ai_analysis a on a.job_posting_id=j.id and a.status='COMPLETED'
                    where j.deadline_date is null or j.deadline_date >= (current_timestamp at time zone 'Asia/Seoul')::date
                    """;
            case SAVED_JOB_UPDATE -> """
                    select b.user_id, e.id as source_id, e.occurred_at as scheduled_at, e.subject
                    from notification_job_update e join bookmark b on b.job_posting_id=e.job_posting_id
                    where b.created_at < e.occurred_at
                    """;
            case DOCUMENT_ANALYSIS -> """
                    select coalesce(r.user_id,c.user_id) as user_id, a.id as source_id,
                      a.analyzed_at as scheduled_at,
                      case when r.id is not null then '이력서 분석이 완료되었습니다.'
                        else '자기소개서 분석이 완료되었습니다.' end as subject
                    from document_analysis a
                    left join resume_version rv on rv.id=a.resume_version_id
                    left join resume r on r.id=rv.resume_id
                    left join cover_letter_version cv on cv.id=a.cover_letter_version_id
                    left join cover_letter c on c.id=cv.cover_letter_id
                    where a.status='COMPLETED' and a.analyzed_at is not null
                    """;
            case MATCH_ANALYSIS -> """
                    select req.user_id, a.job_posting_id as source_id, a.analyzed_at as scheduled_at,
                      left('공고 기술 분석 완료: ' || j.title, 200) as subject
                    from ai_analysis a join user_ai_analysis_request req on req.job_posting_id=a.job_posting_id
                    join job_posting j on j.id=a.job_posting_id
                    where a.status='COMPLETED' and a.analyzed_at is not null
                    """;
            case PERSONAL_JOB_ANALYSIS -> """
                    select j.user_id, j.id as source_id, a.analyzed_at as scheduled_at,
                      left('직접 등록 공고 분석 완료: ' || j.title, 200) as subject
                    from personal_saved_job_analysis a
                    join personal_saved_job j on j.id=a.personal_saved_job_id
                    where a.status='COMPLETED' and a.analyzed_at is not null
                      and j.deleted_at is null
                    """;
            case SEMANTIC_RECOMMENDATION -> """
                    select r.user_id, r.id as source_id, r.analyzed_at as scheduled_at,
                      '의미 기반 공고 비교 결과가 준비되었습니다.' as subject
                    from semantic_recommendation r
                    where r.status='COMPLETED' and r.analyzed_at is not null
                    """;
            case LEARNING_GOAL_REMINDER -> """
                    select g.user_id, g.id as source_id,
                      (date_trunc('week', current_timestamp at time zone 'Asia/Seoul') + interval '9 hours')
                        at time zone 'Asia/Seoul' as scheduled_at,
                      left('학습 목표를 다시 확인해 보세요: ' || g.title, 200) as subject
                    from learning_goal g where g.deleted_at is null and g.completed_at is null
                      and g.updated_at <= ((date_trunc('week', current_timestamp at time zone 'Asia/Seoul')
                        + interval '9 hours') at time zone 'Asia/Seoul') - interval '7 days'
                    """;
            case CHARACTER_ACTIVITY -> """
                    select a.user_id, a.id * 2 as source_id, a.earned_at as scheduled_at,
                      '캐릭터 경험치를 획득했습니다.' as subject from character_activity a
                    union all
                    select r.user_id, r.id * 2 + 1, r.claimed_at,
                      '캐릭터 퀘스트 보상을 받았습니다.' from character_reward r
                    """;
            case SERVICE_NOTICE -> """
                    select u.id as user_id, n.id as source_id, n.published_at as scheduled_at,
                      n.title as subject from service_notice n join users u on u.created_at <= n.published_at
                    """;
            case AI_JOB_RECOMMENDATION -> """
                    with owned as (
                      select us.user_id,s.normalized_name as skill from user_skill us
                        join skill s on s.id=us.skill_id
                      union select p.user_id,s.normalized_name from project_skill ps
                        join project p on p.id=ps.project_id join skill s on s.id=ps.skill_id
                      union select user_id,normalized_name from user_custom_skill
                    ), rates as (
                      select users.user_id,j.id,j.title,j.deadline_date,a.analyzed_at,
                        round(100.0 * count(o.skill) / count(*))::integer as rate
                      from (select distinct user_id from owned) users cross join job_posting j
                      join ai_analysis a on a.job_posting_id=j.id and a.status='COMPLETED'
                      join job_skill js on js.job_posting_id=j.id join skill s on s.id=js.skill_id
                      left join owned o on o.user_id=users.user_id and o.skill=s.normalized_name
                      where (j.deadline_date is null or j.deadline_date >= (current_timestamp at time zone 'Asia/Seoul')::date)
                        and not exists (select 1 from application ap where ap.user_id=users.user_id
                          and ap.job_posting_id=j.id and ap.deleted_at is null)
                      group by users.user_id,j.id,j.title,j.deadline_date,a.analyzed_at
                      having count(o.skill) > 0
                    ), ranked as (
                      select rates.*,row_number() over (partition by user_id
                        order by rate desc,deadline_date asc nulls last,id desc) as position from rates
                    )
                    select user_id,id as source_id,analyzed_at as scheduled_at,
                      left('맞춤 공고 추천: ' || title, 200) as subject
                    from ranked where position <= 3
                    """;
            default -> throw new IllegalArgumentException("Not an expanded notification: " + type);
        };
        // The start row excludes old data. A preference change also prevents backfilling while opted out.
        String sql = """
                select e.user_id, e.source_id, e.scheduled_at, e.subject
                from (
                """ + events + """
                ) e cross join notification_delivery_start rollout
                left join notification_preference p on p.user_id=e.user_id and p.type=?
                where e.user_id is not null and e.scheduled_at is not null
                  and e.scheduled_at >= greatest(rollout.started_at, coalesce(p.changed_at, rollout.started_at))
                  and e.scheduled_at <= current_timestamp
                  and coalesce(p.enabled, ?) = true
                  and not exists (select 1 from notification n where n.user_id=e.user_id
                    and n.type=? and n.source_id=e.source_id and n.scheduled_at=e.scheduled_at)
                """ + (sourceId == null ? "" : " and e.source_id=? and e.scheduled_at=? ") + """
                order by e.scheduled_at, e.user_id
                """;
        boolean defaultEnabled = type != NotificationType.SAVED_JOB_UPDATE
                && type != NotificationType.SEMANTIC_RECOMMENDATION
                && type != NotificationType.SERVICE_NOTICE;
        NotificationType preferenceType = type == NotificationType.PERSONAL_JOB_ANALYSIS
                ? NotificationType.MATCH_ANALYSIS : type;
        var mapper = (org.springframework.jdbc.core.RowMapper<NotificationRepository.DueEvent>)
                (rs, row) -> new NotificationRepository.DueEvent(
                        rs.getLong(2), rs.getLong(1), rs.getTimestamp(3).toInstant(), rs.getString(4));
        return sourceId == null
                ? jdbc.query(sql + " limit 200", mapper, preferenceType.name(), defaultEnabled, type.name())
                : jdbc.query(sql, mapper, preferenceType.name(), defaultEnabled, type.name(),
                        sourceId, Timestamp.from(occurredAt));
    }
}
