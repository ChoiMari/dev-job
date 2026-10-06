package com.devjob.job.repository;

import com.devjob.job.dto.JobQuery;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JobMatchQueryRepository {
    private static final String RATES = """
            with owned as (
              select skill_id from user_skill where user_id = :userId
              union
              select ps.skill_id from project_skill ps join project p on p.id = ps.project_id where p.user_id = :userId
            ), rates as (
              select js.job_posting_id, round(100.0 * count(o.skill_id) / count(*))::integer as rate
              from job_skill js join ai_analysis a on a.job_posting_id = js.job_posting_id and a.status = 'COMPLETED'
              left join owned o on o.skill_id = js.skill_id
              where exists (select 1 from owned)
              group by js.job_posting_id
            )
            """;
    private final NamedParameterJdbcTemplate jdbc;
    public JobMatchQueryRepository(NamedParameterJdbcTemplate jdbc) { this.jdbc = jdbc; }

    public Map<Long, Integer> ratesForJobs(Long userId, List<Long> ids) {
        if (ids.isEmpty()) return Map.of();
        var parameters = new MapSqlParameterSource().addValue("userId", userId).addValue("ids", ids);
        Map<Long, Integer> result = new HashMap<>();
        jdbc.query(RATES + "select job_posting_id, rate from rates where job_posting_id in (:ids)", parameters,
                (org.springframework.jdbc.core.RowCallbackHandler) row -> result.put(row.getLong("job_posting_id"), row.getInt("rate")));
        return result;
    }

    public RankedPage ranked(Long userId, JobQuery input) {
        var parameters = new MapSqlParameterSource().addValue("userId", userId);
        var from = new StringBuilder(" from job_posting j join company c on c.id = j.company_id left join rates r on r.job_posting_id = j.id where 1=1");
        if (input.q() != null) {
            from.append(" and (lower(j.title) like :q escape '\\' or lower(c.name) like :q escape '\\')");
            parameters.addValue("q", pattern(input.q()));
        }
        if (input.company() != null) { from.append(" and lower(c.name) like :company escape '\\'"); parameters.addValue("company", pattern(input.company())); }
        if (input.location() != null) { from.append(" and lower(j.location) like :location escape '\\'"); parameters.addValue("location", pattern(input.location())); }
        if (input.careerLevel() != null) { from.append(" and lower(j.career_requirement) = :career"); parameters.addValue("career", input.careerLevel().toLowerCase(java.util.Locale.ROOT)); }
        if (input.employmentType() != null) { from.append(" and lower(j.employment_type) = :employment"); parameters.addValue("employment", input.employmentType().toLowerCase(java.util.Locale.ROOT)); }
        if (input.deadline() != null) { from.append(" and j.deadline_date <= :deadline"); parameters.addValue("deadline", input.deadline()); }
        if (input.skill() != null) {
            from.append(" and exists (select 1 from job_skill js join ai_analysis a on a.job_posting_id = js.job_posting_id and a.status = 'COMPLETED' where js.job_posting_id = j.id and js.skill_id = :skillId)");
            parameters.addValue("skillId", input.skill());
        }
        if (input.applicationStatus() != null) {
            from.append(" and exists (select 1 from application ap where ap.job_posting_id = j.id and ap.user_id = :userId and ap.current_status = :status)");
            parameters.addValue("status", input.applicationStatus());
        }
        if (input.minimumRate() != null) { from.append(" and r.rate >= :minimumRate"); parameters.addValue("minimumRate", input.minimumRate()); }
        long total = jdbc.queryForObject(RATES + "select count(*)" + from, parameters, Long.class);
        parameters.addValue("limit", input.size()).addValue("offset", (long) input.page() * input.size());
        String order = switch (input.sort()) {
            case "deadline" -> "j.deadline_date asc nulls last, j.id desc";
            case "matchRate" -> "r.rate desc nulls last, j.id desc";
            default -> "j.posted_date desc nulls last, j.id desc";
        };
        var ids = jdbc.query(RATES + "select j.id" + from + " order by " + order + " limit :limit offset :offset",
                parameters, (row, index) -> row.getLong(1));
        return new RankedPage(ids, total);
    }

    private static String pattern(String value) {
        return "%" + value.toLowerCase(java.util.Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }
    public record RankedPage(List<Long> ids, long total) { }
}
