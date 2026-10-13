package com.devjob.skill.service;

import java.util.List;
import java.util.Set;
import java.util.HashSet;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AccountSkillService {
    public record CustomSkill(Long id, String name, Integer proficiencyLevel) { }
    public record AiCandidate(Long id, String name, String source) { }
    private final NamedParameterJdbcTemplate jdbc;

    public AccountSkillService(NamedParameterJdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Transactional(readOnly = true)
    public List<CustomSkill> customSkills(long userId) {
        return jdbc.query("""
                select id, name, proficiency_level from user_custom_skill
                where user_id=:userId order by normalized_name, id
                """, args(userId), (row, n) -> new CustomSkill(row.getLong("id"),
                row.getString("name"), (Integer) row.getObject("proficiency_level")));
    }
    @Transactional(readOnly = true)
    public Set<String> customKeys(long userId) {
        return new HashSet<>(jdbc.query("""
                select normalized_name from user_custom_skill where user_id=:userId
                """, args(userId), (row, n) -> row.getString(1)));
    }

    @Transactional
    public CustomSkill create(long userId, String rawName) {
        var name = SkillName.parse(rawName);
        rejectSystemName(name.key());
        rejectOwnedName(userId, name.key());
        try {
            Long id = jdbc.queryForObject("""
                    insert into user_custom_skill(user_id, name, normalized_name)
                    values (:userId, :name, :key) returning id
                    """, args(userId).addValue("name", name.display()).addValue("key", name.key()), Long.class);
            return find(userId, id);
        } catch (DuplicateKeyException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 등록한 기술입니다.");
        }
    }

    @Transactional
    public CustomSkill update(long userId, long id, String rawName, Integer level) {
        if (id < 1 || level != null && (level < 1 || level > 5)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        var name = SkillName.parse(rawName);
        rejectSystemName(name.key());
        rejectOwnedName(userId, name.key());
        try {
            int changed = jdbc.update("""
                    update user_custom_skill set name=:name, normalized_name=:key,
                    proficiency_level=:level where id=:id and user_id=:userId
                    """, args(userId).addValue("id", id).addValue("name", name.display())
                    .addValue("key", name.key()).addValue("level", level));
            if (changed == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
            return find(userId, id);
        } catch (DuplicateKeyException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 등록한 기술입니다.");
        }
    }

    @Transactional
    public CustomSkill convertLegacy(long userId, long skillId, String rawName, Integer level) {
        if (skillId < 1 || level != null && (level < 1 || level > 5))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        var name = SkillName.parse(rawName);
        rejectSystemName(name.key());
        var rows = jdbc.query("""
                select us.experience_months from user_skill us join skill s on s.id=us.skill_id
                where us.user_id=:userId and us.skill_id=:skillId and s.is_system=false
                for update of us
                """, args(userId).addValue("skillId", skillId),
                (row, n) -> (Integer) row.getObject("experience_months"));
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        try {
            Long id = jdbc.queryForObject("""
                    insert into user_custom_skill
                      (user_id, name, normalized_name, proficiency_level, experience_months)
                    values (:userId, :name, :key, :level, :months) returning id
                    """, args(userId).addValue("name", name.display()).addValue("key", name.key())
                    .addValue("level", level).addValue("months", rows.get(0)), Long.class);
            jdbc.update("delete from user_skill where user_id=:userId and skill_id=:skillId",
                    args(userId).addValue("skillId", skillId));
            return find(userId, id);
        } catch (DuplicateKeyException exception) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 등록한 기술입니다.");
        }
    }

    @Transactional
    public void deleteCustom(long userId, long id) {
        if (id < 1) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        if (jdbc.update("delete from user_custom_skill where id=:id and user_id=:userId",
                args(userId).addValue("id", id)) == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    }

    @Transactional(readOnly = true)
    public List<AiCandidate> candidates(long userId) {
        return jdbc.query("""
                select id, name from user_ai_skill_candidate where user_id=:userId
                order by created_at desc, id desc
                """, args(userId), (row, n) -> new AiCandidate(row.getLong("id"), row.getString("name"), "AI"));
    }

    @Transactional
    public void deleteCandidate(long userId, long id) {
        if (id < 1) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        if (jdbc.update("delete from user_ai_skill_candidate where id=:id and user_id=:userId",
                args(userId).addValue("id", id)) == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    }

    @Transactional
    public void recordAnalysisRequester(long userId, long jobId) {
        jdbc.update("""
                insert into user_ai_analysis_request(user_id, job_posting_id)
                values (:userId, :jobId) on conflict do nothing
                """, args(userId).addValue("jobId", jobId));
    }

    @Transactional(readOnly = true)
    public boolean hasRequestedAnalysis(long userId, long jobId) {
        Boolean requested = jdbc.queryForObject("""
                select exists(select 1 from user_ai_analysis_request
                  where user_id=:userId and job_posting_id=:jobId)
                """, args(userId).addValue("jobId", jobId), Boolean.class);
        return Boolean.TRUE.equals(requested);
    }

    @Transactional
    public void publishCompletedJob(long userId, long jobId) {
        var names = jdbc.query("""
                select entry->>'name' from ai_analysis a,
                  jsonb_array_elements(a.result_json->'skills') entry
                where a.job_posting_id=:jobId and a.status='COMPLETED'
                """, args(userId).addValue("jobId", jobId), (row, n) -> row.getString(1));
        for (String name : names) addCandidate(userId, name, jobId, null);
    }

    @Transactional
    public void publishForRequesters(long jobId, List<String> names) {
        var users = jdbc.query("""
                select user_id from user_ai_analysis_request where job_posting_id=:jobId
                """, new MapSqlParameterSource("jobId", jobId), (row, n) -> row.getLong(1));
        for (Long userId : users) for (String name : names) addCandidate(userId, name, jobId, null);
    }

    @Transactional
    public void publishPersonal(long userId, long personalJobId, List<String> names) {
        for (String name : names) addCandidate(userId, name, null, personalJobId);
    }

    private void addCandidate(long userId, String rawName, Long jobId, Long personalJobId) {
        var name = SkillName.parse(rawName);
        jdbc.update("""
                insert into user_ai_skill_candidate
                  (user_id, name, normalized_name, source_job_posting_id, source_personal_saved_job_id)
                values (:userId, :name, :key, :jobId, :personalJobId)
                on conflict (user_id, normalized_name) do nothing
                """, args(userId).addValue("name", name.display()).addValue("key", name.key())
                .addValue("jobId", jobId).addValue("personalJobId", personalJobId));
    }

    private CustomSkill find(long userId, long id) {
        return jdbc.query("""
                select id, name, proficiency_level from user_custom_skill where id=:id and user_id=:userId
                """, args(userId).addValue("id", id), (row, n) -> new CustomSkill(row.getLong("id"),
                row.getString("name"), (Integer) row.getObject("proficiency_level")))
                .stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    private void rejectSystemName(String key) {
        Long count = jdbc.queryForObject("""
                select count(*) from skill s
                where s.is_system=true and (s.normalized_name=:key
                or exists (select 1 from skill_alias a where a.skill_id=s.id and a.normalized_name=:key))
                """, new MapSqlParameterSource("key", key), Long.class);
        if (count != null && count > 0) throw new ResponseStatusException(HttpStatus.CONFLICT, "고정 기술 목록에서 선택해 주세요.");
    }
    private void rejectOwnedName(long userId, String key) {
        Long count = jdbc.queryForObject("""
                select count(*) from user_skill us join skill s on s.id=us.skill_id
                where us.user_id=:userId and s.normalized_name=:key
                """, args(userId).addValue("key", key), Long.class);
        if (count != null && count > 0)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 보유한 기술입니다.");
    }

    private static MapSqlParameterSource args(long userId) {
        return new MapSqlParameterSource("userId", userId);
    }
}
