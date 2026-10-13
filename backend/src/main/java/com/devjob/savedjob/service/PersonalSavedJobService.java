package com.devjob.savedjob.service;

import com.devjob.savedjob.dto.*;
import com.devjob.savedjob.entity.PersonalSavedJob;
import com.devjob.savedjob.repository.PersonalSavedJobRepository;
import com.devjob.job.service.JobRoles;
import com.devjob.user.repository.UserRepository;
import java.net.URI;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class PersonalSavedJobService {
    private final PersonalSavedJobRepository manual;
    private final UserRepository users;
    private final NamedParameterJdbcTemplate jdbc;
    public PersonalSavedJobService(PersonalSavedJobRepository manual, UserRepository users, NamedParameterJdbcTemplate jdbc) {
        this.manual = manual; this.users = users; this.jdbc = jdbc;
    }
    public SavedJobPage list(Long userId, int page, int size) {
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE) fail(HttpStatus.BAD_REQUEST);
        var params = new org.springframework.jdbc.core.namedparam.MapSqlParameterSource()
                .addValue("userId", userId).addValue("limit", size).addValue("offset", (long) page * size);
        String union = """
                from (
                  select 'COLLECTED' as kind, b.id, j.id as job_id, j.source_url as url,
                    c.name as company_name, j.title, cast(null as varchar) as role,
                    j.career_requirement as career_level, j.location, j.employment_type,
                    j.deadline_date, cast(null as varchar) as note, cast(null as text) as description,
                    s.code as source, b.created_at
                  from bookmark b join job_posting j on j.id=b.job_posting_id
                    join company c on c.id=j.company_id join job_source s on s.id=j.job_source_id
                  where b.user_id=:userId
                  union all
                  select 'MANUAL', p.id, cast(null as bigint), p.url, p.company_name, p.title,
                    p.role, p.career_level, p.location, p.employment_type, p.deadline_date,
                    p.note, p.description, 'DIRECT', p.created_at
                  from personal_saved_job p where p.user_id=:userId and p.deleted_at is null
                ) saved
                """;
        long total = jdbc.queryForObject("select count(*) " + union, params, Long.class);
        var items = jdbc.query("""
                select saved.*, a.current_status as application_status,
                  case when saved.kind='COLLECTED' then
                    case when ar.user_id is not null then ca.status else null end
                    else pa.status end as analysis_status
                """ + union + """
                left join application a on a.user_id=:userId and a.deleted_at is null and
                  ((saved.kind='COLLECTED' and a.job_posting_id=saved.job_id) or
                   (saved.kind='MANUAL' and a.personal_saved_job_id=saved.id))
                left join ai_analysis ca on saved.kind='COLLECTED' and ca.job_posting_id=saved.job_id
                left join user_ai_analysis_request ar on saved.kind='COLLECTED'
                  and ar.user_id=:userId and ar.job_posting_id=saved.job_id
                left join personal_saved_job_analysis pa on saved.kind='MANUAL' and pa.personal_saved_job_id=saved.id
                order by saved.created_at desc, saved.kind, saved.id desc limit :limit offset :offset
                """, params, (row, i) -> new SavedJobPage.Item(row.getString("kind"), row.getLong("id"),
                row.getObject("job_id", Long.class), row.getString("url"), row.getString("company_name"),
                row.getString("title"), "COLLECTED".equals(row.getString("kind"))
                        ? JobRoles.classify(row.getString("title")) : row.getString("role"), row.getString("career_level"),
                row.getString("location"), row.getString("employment_type"),
                row.getObject("deadline_date", java.time.LocalDate.class), row.getString("note"),
                row.getString("description"), row.getString("source"), row.getString("application_status"),
                row.getString("analysis_status"),
                row.getTimestamp("created_at").toInstant()));
        return new SavedJobPage(items, page, size, total);
    }
    public PersonalSavedJobResponse detail(Long userId, long id) { return PersonalSavedJobResponse.from(owned(userId, id)); }
    @Transactional
    public PersonalSavedJobResponse create(Long userId, PersonalSavedJobInput input) {
        String url = url(input.url());
        if (manual.existsByUserIdAndUrlAndDeletedAtIsNull(userId, url)) fail(HttpStatus.CONFLICT);
        var user = users.findById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        try { return PersonalSavedJobResponse.from(manual.saveAndFlush(new PersonalSavedJob(user, url,
                required(input.companyName()), required(input.title()), optional(input.role()), optional(input.careerLevel()),
                optional(input.location()), optional(input.employmentType()), input.deadlineDate(), optional(input.note()), optional(input.description())))); }
        catch (DataIntegrityViolationException exception) { throw new ResponseStatusException(HttpStatus.CONFLICT); }
    }
    @Transactional
    public PersonalSavedJobResponse update(Long userId, long id, PersonalSavedJobInput input) {
        var saved = owned(userId, id);
        boolean analysisInputChanged = !java.util.Objects.equals(saved.getTitle(), input.title().strip())
                || !java.util.Objects.equals(saved.getDescription(), optional(input.description()));
        String url = url(input.url());
        if (manual.existsByUserIdAndUrlAndIdNotAndDeletedAtIsNull(userId, url, id)) fail(HttpStatus.CONFLICT);
        saved.update(url, required(input.companyName()), required(input.title()), optional(input.role()),
                optional(input.careerLevel()), optional(input.location()), optional(input.employmentType()),
                input.deadlineDate(), optional(input.note()), optional(input.description()));
        if (analysisInputChanged) jdbc.getJdbcTemplate().update(
                "delete from personal_saved_job_analysis where personal_saved_job_id=?", id);
        try { manual.flush(); return PersonalSavedJobResponse.from(saved); }
        catch (DataIntegrityViolationException exception) { throw new ResponseStatusException(HttpStatus.CONFLICT); }
    }
    @Transactional
    public void delete(Long userId, long id) {
        owned(userId, id).delete();
        jdbc.getJdbcTemplate().update("delete from semantic_recommendation where id in "
                + "(select r.id from semantic_recommendation r "
                + "where r.user_id=? and r.candidates @> cast(? as jsonb))", userId,
                "[{\"kind\":\"MANUAL\",\"id\":" + id + "}]");
    }
    private PersonalSavedJob owned(Long userId, long id) {
        if (id < 1) fail(HttpStatus.BAD_REQUEST);
        return manual.findByIdAndUserIdAndDeletedAtIsNull(id, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
    private static String required(String value) {
        if (value == null || value.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        return value.strip();
    }
    private static String optional(String value) { return value == null || value.isBlank() ? null : value.strip(); }
    private static String url(String value) {
        try {
            String trimmed = required(value);
            URI uri = URI.create(trimmed);
            if (!("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                    || uri.getHost() == null || uri.getUserInfo() != null || uri.getFragment() != null) fail(HttpStatus.BAD_REQUEST);
            return uri.toString();
        } catch (IllegalArgumentException exception) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST); }
    }
    private static void fail(HttpStatus status) { throw new ResponseStatusException(status); }
}
