package com.devjob.coverletter.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CoverLetterDraftService {
    public record Summary(Long id, String title, Instant updatedAt) { }
    public record Detail(Long id, String title, String content, Instant updatedAt) { }
    private record Row(Long id, byte[] ciphertext, byte[] nonce, Instant updatedAt) { }

    private final JdbcTemplate jdbc;
    private final CoverLetterCipher cipher;
    private final ObjectMapper json;

    public CoverLetterDraftService(JdbcTemplate jdbc, CoverLetterCipher cipher, ObjectMapper json) {
        this.jdbc = jdbc; this.cipher = cipher; this.json = json;
    }

    @Transactional(readOnly = true)
    public List<Summary> list(Long userId) {
        return rows(userId, null).stream().map(row -> {
            var value = decrypt(userId, row);
            var title = value.path("title").asText().strip();
            return new Summary(row.id(), title.isEmpty() ? "제목 없는 임시저장 자기소개서" : title, row.updatedAt());
        }).toList();
    }

    @Transactional(readOnly = true)
    public Detail get(Long userId, Long id) {
        var rows = rows(userId, id);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        var row = rows.get(0);
        var value = decrypt(userId, row);
        return new Detail(row.id(), value.path("title").asText(), value.path("content").asText(), row.updatedAt());
    }

    @Transactional
    public Summary create(Long userId, JsonNode body) {
        String payload = payload(body);
        jdbc.queryForObject("select id from users where id=? for update", Long.class, userId);
        if (jdbc.queryForObject("select count(*) from cover_letter_draft where user_id=?", Long.class, userId) >= 20)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "임시저장 자기소개서는 최대 20개까지 저장할 수 있습니다.");
        var encrypted = cipher.encryptDraft(userId, payload);
        var updatedAt = Instant.now();
        Long id = jdbc.queryForObject("insert into cover_letter_draft(user_id,content_ciphertext,content_nonce,updated_at) "
                + "values (?,?,?,?) returning id", Long.class,
                userId, encrypted.ciphertext(), encrypted.nonce(), Timestamp.from(updatedAt));
        return new Summary(id, displayTitle(body), updatedAt);
    }

    @Transactional
    public Summary save(Long userId, Long id, JsonNode body) {
        positive(id);
        String payload = payload(body);
        var encrypted = cipher.encryptDraft(userId, payload);
        var updatedAt = Instant.now();
        if (jdbc.update("update cover_letter_draft set content_ciphertext=?, content_nonce=?, updated_at=? where user_id=? and id=?",
                encrypted.ciphertext(), encrypted.nonce(), Timestamp.from(updatedAt), userId, id) == 0)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        return new Summary(id, displayTitle(body), updatedAt);
    }

    @Transactional
    public void delete(Long userId, Long id) {
        positive(id);
        if (jdbc.update("delete from cover_letter_draft where user_id=? and id=?", userId, id) == 0)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    }

    public void consume(Long userId, Long id) {
        positive(id);
        if (jdbc.update("delete from cover_letter_draft where user_id=? and id=?", userId, id) == 0)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    }

    private List<Row> rows(Long userId, Long id) {
        String sql = "select id, content_ciphertext, content_nonce, updated_at from cover_letter_draft where user_id=?"
                + (id == null ? " order by updated_at desc, id desc limit 20" : " and id=?");
        return id == null ? jdbc.query(sql, (rs, n) -> new Row(rs.getLong(1), rs.getBytes(2), rs.getBytes(3), rs.getTimestamp(4).toInstant()), userId)
                : jdbc.query(sql, (rs, n) -> new Row(rs.getLong(1), rs.getBytes(2), rs.getBytes(3), rs.getTimestamp(4).toInstant()), userId, id);
    }

    private JsonNode decrypt(Long userId, Row row) {
        try { return json.readTree(cipher.decryptDraft(userId, row.ciphertext(), row.nonce())); }
        catch (JsonProcessingException exception) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "저장된 임시저장을 읽을 수 없습니다.");
        }
    }

    private String payload(JsonNode body) {
        if (body == null || !body.isObject() || body.size() != 2 || !body.has("title") || !body.has("content")
                || !text(body.get("title"), 200) || !text(body.get("content"), 100_000)) throw badInput();
        String payload;
        try { payload = json.writeValueAsString(body); }
        catch (JsonProcessingException exception) { throw badInput(); }
        if (payload.getBytes(StandardCharsets.UTF_8).length > 262_144) throw badInput();
        return payload;
    }

    private static String displayTitle(JsonNode body) {
        String title = body.path("title").asText().strip();
        return title.isEmpty() ? "제목 없는 임시저장 자기소개서" : title;
    }

    private static boolean text(JsonNode node, int max) {
        return node != null && node.isTextual() && node.textValue().length() <= max
                && node.textValue().codePoints().noneMatch(c -> Character.isISOControl(c) && c != '\n' && c != '\r' && c != '\t');
    }

    private static void positive(Long id) { if (id == null || id <= 0) throw badInput(); }
    private static ResponseStatusException badInput() { return new ResponseStatusException(HttpStatus.BAD_REQUEST); }
}
