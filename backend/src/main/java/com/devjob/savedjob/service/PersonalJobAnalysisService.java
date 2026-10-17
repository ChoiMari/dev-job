package com.devjob.savedjob.service;

import com.devjob.analysis.adapter.AnalysisGateway;
import com.devjob.analysis.entity.JobSkill;
import com.devjob.analysis.service.AnalysisOutputValidator;
import com.devjob.savedjob.dto.PersonalJobAnalysisResponse;
import com.devjob.skill.service.SkillName;
import com.devjob.skill.service.AccountSkillService;
import com.devjob.notification.NotificationEventRecorder;
import com.devjob.notification.NotificationType;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PersonalJobAnalysisService {
    private final NamedParameterJdbcTemplate jdbc;
    private final AnalysisGateway gateway;
    private final AnalysisOutputValidator validator;
    private final ObjectMapper mapper;
    private final AccountSkillService accountSkills;
    private final NotificationEventRecorder notifications;
    private final TransactionTemplate transaction;
    public PersonalJobAnalysisService(NamedParameterJdbcTemplate jdbc, AnalysisGateway gateway,
            AnalysisOutputValidator validator, ObjectMapper mapper, AccountSkillService accountSkills,
            NotificationEventRecorder notifications, PlatformTransactionManager manager) {
        this.jdbc = jdbc; this.gateway = gateway; this.validator = validator; this.mapper = mapper;
        this.accountSkills = accountSkills;
        this.notifications = notifications;
        this.transaction = new TransactionTemplate(manager);
    }
    public PersonalJobAnalysisResponse get(Long userId, long id) {
        owned(userId, id);
        return jdbc.query("""
                select a.status, a.result_json::text as result_json, a.failure_reason, a.analyzed_at
                from personal_saved_job_analysis a where a.personal_saved_job_id=:id
                """, new MapSqlParameterSource("id", id), (row, n) -> response(row.getString("status"),
                row.getString("result_json"), row.getString("failure_reason"), row.getTimestamp("analyzed_at")))
                .stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
    public PersonalJobAnalysisResponse request(Long userId, long id) {
        var job = owned(userId, id);
        if (job.description() == null || job.description().isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "공고 본문을 먼저 입력해 주세요.");
        try { var previous = get(userId, id); if ("COMPLETED".equals(previous.status())) {
            accountSkills.publishPersonal(userId, id, java.util.stream.Stream
                    .concat(previous.requiredSkills().stream(), previous.preferredSkills().stream()).toList());
            return previous;
        } }
        catch (ResponseStatusException exception) { if (exception.getStatusCode() != HttpStatus.NOT_FOUND) throw exception; }
        if (!gateway.available()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "AI 분석 서버 키가 설정되지 않았습니다.");
        PersonalJobAnalysisResponse result;
        try {
            var extracted = validator.parse(gateway.analyze(job.title(), job.description()));
            var canonical = new LinkedHashMap<String, AnalysisOutputValidator.ExtractedSkill>();
            for (var item : extracted) {
                String key = SkillName.parse(item.name()).key();
                var old = canonical.get(key);
                if (old == null || item.type() == JobSkill.RequirementType.REQUIRED) canonical.put(key, item);
            }
            var normalized = List.copyOf(canonical.values());
            result = new PersonalJobAnalysisResponse("COMPLETED",
                    names(normalized, JobSkill.RequirementType.REQUIRED),
                    names(normalized, JobSkill.RequirementType.PREFERRED), Instant.now(), null);
        } catch (Exception exception) {
            result = new PersonalJobAnalysisResponse("FAILED", List.of(), List.of(), null,
                    "분석을 완료하지 못했습니다. 다시 시도해 주세요.");
        }
        try {
            String json = mapper.writeValueAsString(Map.of("requiredSkills", result.requiredSkills(),
                    "preferredSkills", result.preferredSkills()));
            PersonalJobAnalysisResponse completed = result;
            return transaction.execute(status -> {
                var args = new MapSqlParameterSource("id", id).addValue("userId", userId)
                        .addValue("version", Timestamp.from(job.updatedAt())).addValue("status", completed.status())
                        .addValue("json", json)
                        .addValue("reason", completed.failureReason())
                        .addValue("analyzedAt", completed.analyzedAt() == null ? null : Timestamp.from(completed.analyzedAt()), java.sql.Types.TIMESTAMP)
                        .addValue("updatedAt", Timestamp.from(Instant.now()));
                int saved = jdbc.update("""
                        insert into personal_saved_job_analysis
                            (personal_saved_job_id, status, result_json, failure_reason, analyzed_at, updated_at)
                        select p.id, :status, cast(:json as jsonb), :reason, :analyzedAt, :updatedAt
                        from personal_saved_job p where p.id=:id and p.user_id=:userId
                            and p.deleted_at is null and p.updated_at=:version
                        on conflict (personal_saved_job_id) do update set status=excluded.status,
                            result_json=excluded.result_json, failure_reason=excluded.failure_reason,
                            analyzed_at=excluded.analyzed_at, updated_at=excluded.updated_at
                        """, args);
                if (saved == 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "공고가 변경되었습니다. 다시 시도해 주세요.");
                if ("COMPLETED".equals(completed.status())) {
                    accountSkills.publishPersonal(userId, id, java.util.stream.Stream
                            .concat(completed.requiredSkills().stream(), completed.preferredSkills().stream()).toList());
                    notifications.record(NotificationType.PERSONAL_JOB_ANALYSIS, id, completed.analyzedAt());
                }
                return completed;
            });
        } catch (com.fasterxml.jackson.core.JsonProcessingException exception) {
            throw new IllegalStateException("Validated analysis could not be stored");
        }
    }
    private JobInput owned(Long userId, long id) {
        if (id < 1) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        return jdbc.query("""
                select title, description, updated_at from personal_saved_job
                where id=:id and user_id=:userId and deleted_at is null
                """, new MapSqlParameterSource("id", id).addValue("userId", userId),
                (row, n) -> new JobInput(row.getString("title"), row.getString("description"),
                        row.getTimestamp("updated_at").toInstant())).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
    private static List<String> names(List<AnalysisOutputValidator.ExtractedSkill> values, JobSkill.RequirementType type) {
        return values.stream().filter(item -> item.type() == type).map(AnalysisOutputValidator.ExtractedSkill::name)
                .distinct().toList();
    }
    private PersonalJobAnalysisResponse response(String status, String json, String reason, Timestamp at) {
        try {
            var root = mapper.readTree(json);
            var required = mapper.readerForListOf(String.class).<List<String>>readValue(root.get("requiredSkills"));
            var preferred = mapper.readerForListOf(String.class).<List<String>>readValue(root.get("preferredSkills"));
            return new PersonalJobAnalysisResponse(status, required, preferred, at == null ? null : at.toInstant(), reason);
        } catch (Exception exception) { throw new IllegalStateException("Stored analysis is invalid"); }
    }
    private record JobInput(String title, String description, Instant updatedAt) { }
}
