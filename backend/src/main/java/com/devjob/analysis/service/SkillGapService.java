package com.devjob.analysis.service;

import com.devjob.analysis.dto.SkillGap;
import com.devjob.analysis.dto.SkillGapItem;
import com.devjob.analysis.dto.SkillGapScore;
import com.devjob.profile.repository.ProfileRepository;
import com.devjob.project.repository.ProjectSkillRepository;
import com.devjob.skill.dto.SkillResponse;
import com.devjob.skill.repository.UserSkillRepository;
import com.devjob.skill.service.AccountSkillService;
import java.util.Comparator;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class SkillGapService {
    private static final String COMPLETED = " from ai_analysis a join job_posting j on j.id = a.job_posting_id"
            + " where a.status = 'COMPLETED'";
    private static final String PERSONAL_COMPLETED = " from personal_saved_job_analysis a"
            + " join personal_saved_job p on p.id = a.personal_saved_job_id"
            + " where a.status = 'COMPLETED' and p.user_id = :userId and p.deleted_at is null";
    private final ProfileRepository profiles;
    private final UserSkillRepository userSkills;
    private final ProjectSkillRepository projectSkills;
    private final NamedParameterJdbcTemplate jdbc;
    private final AccountSkillService accountSkills;

    public SkillGapService(ProfileRepository profiles, UserSkillRepository userSkills,
            ProjectSkillRepository projectSkills, NamedParameterJdbcTemplate jdbc, AccountSkillService accountSkills) {
        this.profiles = profiles;
        this.userSkills = userSkills;
        this.projectSkills = projectSkills;
        this.jdbc = jdbc;
        this.accountSkills = accountSkills;
    }

    public SkillGap find(Long userId, String requestedRole) {
        String role = normalize(requestedRole);
        if (role == null) role = profiles.findByUserId(userId).map(p -> normalize(p.getDesiredRole())).orElse(null);
        if (role != null && role.length() > 200) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);

        var parameters = new MapSqlParameterSource("userId", userId);
        String roleFilter = role == null ? "" : " and strpos(lower(j.title), :role) > 0";
        String personalRoleFilter = role == null ? "" : " and strpos(lower(p.title), :role) > 0";
        if (role != null) parameters.addValue("role", role.toLowerCase(Locale.ROOT));
        long analyzed = jdbc.queryForObject("select (select count(*)" + COMPLETED + roleFilter
                + ") + (select count(*)" + PERSONAL_COMPLETED + personalRoleFilter + ")", parameters, Long.class);
        Set<Long> owned = new HashSet<>();
        userSkills.findSkills(userId).forEach(skill -> owned.add(skill.getId()));
        owned.addAll(projectSkills.findSkillIdsForUser(userId));
        var customKeys = accountSkills.customKeys(userId);
        if (owned.isEmpty() && customKeys.isEmpty()) return SkillGap.unavailable(role, analyzed, "USER_SKILLS_EMPTY");
        if (analyzed == 0) return SkillGap.unavailable(role, analyzed, "INSUFFICIENT_SAMPLE");

        var rows = jdbc.query("select s.id, s.name,"
                + " count(*) filter (where hits.requirement_type = 'REQUIRED') as required_count,"
                + " count(*) filter (where hits.requirement_type = 'PREFERRED') as preferred_count"
                + " from ("
                + " select js.skill_id, js.requirement_type from job_skill js"
                + " join ai_analysis a on a.job_posting_id = js.job_posting_id"
                + " join job_posting j on j.id = a.job_posting_id"
                + " where a.status = 'COMPLETED'" + roleFilter
                + " union all select personal_hits.skill_id, personal_hits.requirement_type from ("
                + " select distinct on (p.id, s.id) s.id as skill_id, skill_name.requirement_type"
                + " from personal_saved_job_analysis a"
                + " join personal_saved_job p on p.id = a.personal_saved_job_id"
                + " cross join lateral ("
                + " select value, 'REQUIRED' as requirement_type"
                + " from jsonb_array_elements_text(coalesce(a.result_json->'requiredSkills', '[]'::jsonb))"
                + " union all select value, 'PREFERRED' as requirement_type"
                + " from jsonb_array_elements_text(coalesce(a.result_json->'preferredSkills', '[]'::jsonb))"
                + " ) skill_name"
                + " join skill s on lower(s.name) = lower(skill_name.value)"
                + " where a.status = 'COMPLETED' and p.user_id = :userId and p.deleted_at is null" + personalRoleFilter
                + " order by p.id, s.id, case when skill_name.requirement_type = 'REQUIRED' then 0 else 1 end"
                + " ) personal_hits"
                + " ) hits join skill s on s.id = hits.skill_id"
                + " group by s.id, s.name", parameters, (rs, index) -> {
                    long required = rs.getLong("required_count");
                    long preferred = rs.getLong("preferred_count");
                    long count = required + preferred;
                    return new SkillGapItem(new SkillResponse(rs.getLong("id"), rs.getString("name")),
                            count, required, preferred, (double) count / analyzed,
                            SkillGapScore.calculate(required, preferred, analyzed));
                });
        if (rows.isEmpty()) return SkillGap.unavailable(role, analyzed, "NO_JOB_SKILLS");

        var missing = rows.stream().filter(item -> !owned.contains(item.skill().id())
                        && !customKeys.contains(com.devjob.skill.service.SkillName.parse(item.skill().name()).key()))
                .sorted(Comparator.comparingDouble(SkillGapItem::priorityScore).reversed()
                        .thenComparing(Comparator.comparingLong(SkillGapItem::demandJobCount).reversed())
                        .thenComparing(item -> item.skill().name())
                        .thenComparing(item -> item.skill().id()))
                .toList();
        return new SkillGap(true, role, analyzed, analyzed < 10, missing.size(),
                missing.stream().limit(5).toList(), null);
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
