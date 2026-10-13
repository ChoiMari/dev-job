package com.devjob.company.service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CompanyTagService {
    public record Tag(Long id, String name, String colorKey, int sortOrder) { }
    private static final List<String> DEFAULT_NAMES = List.of(
            "AI", "백엔드", "프론트엔드", "클라우드", "데이터", "핀테크", "커머스", "모바일");
    private static final List<String> DEFAULT_COLORS = List.of(
            "blue", "green", "pink", "mint", "purple", "sky", "orange", "yellow");
    private static final Set<String> COLORS = Set.of(
            "blue", "green", "pink", "yellow", "purple", "sky", "orange", "red", "mint", "gray");
    private final JdbcTemplate jdbc;
    public CompanyTagService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Transactional
    public List<Tag> list(long userId) {
        seed(userId);
        return read(userId);
    }

    @Transactional
    public Tag create(long userId, String rawName, String colorKey) {
        String name = validName(rawName);
        validColor(colorKey);
        seed(userId);
        if (read(userId).size() >= 30) throw error(HttpStatus.CONFLICT);
        try {
            int order = jdbc.queryForObject(
                    "select coalesce(max(sort_order),-1)+1 from personal_company_tag where user_id=?",
                    Integer.class, userId);
            Long id = jdbc.queryForObject(
                    "insert into personal_company_tag(user_id,name,color_key,sort_order) values (?,?,?,?) returning id",
                    Long.class, userId, name, colorKey, order);
            return new Tag(id, name, colorKey, order);
        } catch (DataIntegrityViolationException exception) { throw error(HttpStatus.CONFLICT); }
    }

    @Transactional
    public Tag update(long userId, long tagId, String rawName, String colorKey) {
        String name = validName(rawName);
        validColor(colorKey);
        lock(userId);
        Tag current = find(userId, tagId);
        try {
            jdbc.update("update personal_company_tag set name=?, color_key=? where id=? and user_id=?",
                    name, colorKey, tagId, userId);
            if (!current.name().equals(name)) {
                jdbc.update("update interested_company_tag set tag=? where tag=? and company_id in "
                        + "(select id from interested_company where user_id=?)", name, current.name(), userId);
            }
            return new Tag(tagId, name, colorKey, current.sortOrder());
        } catch (DataIntegrityViolationException exception) { throw error(HttpStatus.CONFLICT); }
    }

    @Transactional
    public List<Tag> reorder(long userId, List<Long> ids) {
        lock(userId);
        List<Tag> existing = read(userId);
        Set<Long> owned = new HashSet<>(existing.stream().map(Tag::id).toList());
        if (ids == null || ids.size() != existing.size() || ids.contains(null)
                || !new HashSet<>(ids).equals(owned)) throw error(HttpStatus.BAD_REQUEST);
        for (int index = 0; index < ids.size(); index++)
            jdbc.update("update personal_company_tag set sort_order=? where id=? and user_id=?",
                    index, ids.get(index), userId);
        return read(userId);
    }

    @Transactional
    public void delete(long userId, long tagId) {
        lock(userId);
        Tag tag = find(userId, tagId);
        if (read(userId).size() <= 1) throw error(HttpStatus.CONFLICT);
        jdbc.update("delete from interested_company_tag where tag=? and company_id in "
                + "(select id from interested_company where user_id=?)", tag.name(), userId);
        // Negative staging avoids duplicate (company_id, position) keys while positions are compacted.
        jdbc.update("update interested_company_tag set position=-position-1 where company_id in "
                + "(select id from interested_company where user_id=?)", userId);
        jdbc.update("""
                with ranked as (select company_id, tag,
                    row_number() over (partition by company_id order by position desc) - 1 as next_position
                    from interested_company_tag where company_id in
                    (select id from interested_company where user_id=?))
                update interested_company_tag current set position=ranked.next_position
                from ranked where current.company_id=ranked.company_id and current.tag=ranked.tag
                """, userId);
        jdbc.update("delete from personal_company_tag where id=? and user_id=?", tagId, userId);
    }

    private List<Tag> read(long userId) {
        return jdbc.query("select id,name,color_key,sort_order from personal_company_tag where user_id=? order by sort_order,id",
                (row, index) -> new Tag(row.getLong("id"), row.getString("name"),
                        row.getString("color_key"), row.getInt("sort_order")), userId);
    }
    private Tag find(long userId, long tagId) {
        return read(userId).stream().filter(tag -> tag.id() == tagId).findFirst()
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND));
    }
    private void lock(long userId) {
        jdbc.queryForObject("select id from users where id=? for update", Long.class, userId);
    }
    private void seed(long userId) {
        lock(userId);
        Integer count = jdbc.queryForObject(
                "select count(*) from personal_company_tag where user_id=?", Integer.class, userId);
        if (count != null && count > 0) return;
        List<Object[]> rows = new ArrayList<>();
        for (int index = 0; index < DEFAULT_NAMES.size(); index++)
            rows.add(new Object[]{userId, DEFAULT_NAMES.get(index), DEFAULT_COLORS.get(index), index});
        jdbc.batchUpdate("insert into personal_company_tag(user_id,name,color_key,sort_order) values (?,?,?,?)", rows);
    }
    private String validName(String rawName) {
        if (rawName == null || rawName.isBlank()) throw error(HttpStatus.BAD_REQUEST);
        String name = rawName.strip();
        if (name.length() > 20 || name.codePoints().anyMatch(c -> Character.isISOControl(c)
                || Character.getType(c) == Character.FORMAT)) throw error(HttpStatus.BAD_REQUEST);
        return name;
    }
    private void validColor(String value) {
        if (value == null || !COLORS.contains(value)) throw error(HttpStatus.BAD_REQUEST);
    }
    private ResponseStatusException error(HttpStatus status) { return new ResponseStatusException(status); }
}
