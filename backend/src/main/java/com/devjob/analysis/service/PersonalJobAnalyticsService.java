package com.devjob.analysis.service;

import com.devjob.analysis.dto.PersonalJobAnalytics;
import com.devjob.skill.service.SkillName;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class PersonalJobAnalyticsService {
    private final NamedParameterJdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public PersonalJobAnalyticsService(NamedParameterJdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public PersonalJobAnalytics find(Long userId) {
        var parameters = new MapSqlParameterSource("userId", userId);
        long saved = jdbc.queryForObject("select count(*) from personal_saved_job"
                + " where user_id = :userId and deleted_at is null", parameters, Long.class);
        List<String> results = jdbc.query("""
                select a.result_json::text from personal_saved_job_analysis a
                join personal_saved_job p on p.id = a.personal_saved_job_id
                where p.user_id = :userId and p.deleted_at is null and a.status = 'COMPLETED'
                order by p.id
                """, parameters, (row, index) -> row.getString(1));
        Map<String, Counts> counts = new HashMap<>();
        for (String json : results) {
            try {
                JsonNode root = mapper.readTree(json);
                Map<String, SkillEntry> byJob = new HashMap<>();
                add(byJob, root.path("preferredSkills"), false);
                add(byJob, root.path("requiredSkills"), true);
                byJob.forEach((key, entry) -> {
                    Counts count = counts.computeIfAbsent(key, ignored -> new Counts(entry.name()));
                    if (entry.required()) count.required++;
                    else count.preferred++;
                });
            } catch (Exception exception) {
                throw new IllegalStateException("Stored personal job analysis is invalid", exception);
            }
        }
        long analyzed = results.size();
        List<PersonalJobAnalytics.SkillDemand> skills = new ArrayList<>();
        counts.forEach((key, count) -> skills.add(new PersonalJobAnalytics.SkillDemand(count.name,
                count.required + count.preferred, count.required, count.preferred,
                (double) (count.required + count.preferred) / analyzed)));
        skills.sort(Comparator.comparingLong(PersonalJobAnalytics.SkillDemand::jobCount).reversed()
                .thenComparing(Comparator.comparingLong(PersonalJobAnalytics.SkillDemand::requiredJobCount).reversed())
                .thenComparing(PersonalJobAnalytics.SkillDemand::name, String.CASE_INSENSITIVE_ORDER));
        return new PersonalJobAnalytics(saved, analyzed, List.copyOf(skills));
    }

    private static void add(Map<String, SkillEntry> byJob, JsonNode values, boolean required) {
        if (!values.isArray()) throw new IllegalStateException("Stored skill list is invalid");
        for (JsonNode value : values) {
            if (!value.isTextual()) throw new IllegalStateException("Stored skill name is invalid");
            SkillName name = SkillName.parse(value.textValue());
            byJob.merge(name.key(), new SkillEntry(name.display(), required),
                    (old, current) -> new SkillEntry(old.name(), old.required() || current.required()));
        }
    }

    private record SkillEntry(String name, boolean required) { }
    private static final class Counts {
        private final String name;
        private long required;
        private long preferred;
        private Counts(String name) { this.name = name; }
    }
}
