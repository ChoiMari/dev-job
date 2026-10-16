package com.devjob.resume.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ResumeDraftService {
    private final JdbcTemplate jdbc;
    private final ResumeCipher cipher;
    private final ObjectMapper json;

    public ResumeDraftService(JdbcTemplate jdbc, ResumeCipher cipher, ObjectMapper json) {
        this.jdbc = jdbc; this.cipher = cipher; this.json = json;
    }

    @Transactional(readOnly = true)
    public JsonNode get(Long userId, Long id) {
        var rows = jdbc.query("select id, content_ciphertext, content_nonce, updated_at from resume_draft where user_id=? and id=?",
                (rs, row) -> new DraftRow(rs.getLong(1), rs.getBytes(2), rs.getBytes(3), rs.getTimestamp(4).toInstant()), userId, id);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        var row = rows.get(0);
        try {
            var value = json.readTree(cipher.decryptDraft(userId, row.ciphertext(), row.nonce()));
            return response(value, row.id(), row.updatedAt());
        } catch (JsonProcessingException exception) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "저장된 임시저장을 읽을 수 없습니다.");
        }
    }

    @Transactional(readOnly = true)
    public ArrayNode list(Long userId) {
        var rows = jdbc.query("select id, content_ciphertext, content_nonce, updated_at from resume_draft "
                + "where user_id=? order by updated_at desc, id desc limit 20",
                (rs, row) -> new DraftRow(rs.getLong(1), rs.getBytes(2), rs.getBytes(3), rs.getTimestamp(4).toInstant()), userId);
        var result = json.createArrayNode();
        for (var row : rows) {
            try {
                var value = json.readTree(cipher.decryptDraft(userId, row.ciphertext(), row.nonce()));
                var item = json.createObjectNode();
                item.put("id", row.id());
                String title = value.path("title").asText().strip();
                if (title.isEmpty()) {
                    String name = value.path("form").path("name").asText().strip();
                    String role = value.path("form").path("desiredRole").asText().strip();
                    title = (name + " " + role).strip();
                }
                item.put("title", title.isEmpty() ? "제목 없는 임시저장 이력서" : title);
                item.put("mode", value.path("mode").asText());
                if (value.path("version").asInt() == 2) {
                    item.put("purpose", value.path("purpose").asText());
                    item.put("resumeId", value.path("resumeId").asLong());
                    if (value.has("versionId")) item.put("versionId", value.path("versionId").asLong());
                }
                item.put("updatedAt", row.updatedAt().toString());
                result.add(item);
            } catch (JsonProcessingException exception) {
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "저장된 임시저장을 읽을 수 없습니다.");
            }
        }
        return result;
    }

    @Transactional
    public JsonNode create(Long userId, JsonNode body) {
        validate(body);
        validateTarget(userId, body);
        var payload = payload(body);
        jdbc.queryForObject("select id from users where id=? for update", Long.class, userId);
        if (jdbc.queryForObject("select count(*) from resume_draft where user_id=?", Long.class, userId) >= 20)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "임시저장 이력서는 최대 20개까지 저장할 수 있습니다.");
        var encrypted = cipher.encryptDraft(userId, payload);
        var updatedAt = Instant.now();
        Long id = jdbc.queryForObject("insert into resume_draft(user_id,content_ciphertext,content_nonce,updated_at) "
                + "values (?,?,?,?) returning id", Long.class,
                userId, encrypted.ciphertext(), encrypted.nonce(), Timestamp.from(updatedAt));
        return response(body, id, updatedAt);
    }

    @Transactional
    public JsonNode save(Long userId, Long id, JsonNode body) {
        validate(body);
        validateTarget(userId, body);
        var encrypted = cipher.encryptDraft(userId, payload(body));
        var updatedAt = Instant.now();
        if (jdbc.update("update resume_draft set content_ciphertext=?, content_nonce=?, updated_at=? where user_id=? and id=?",
                encrypted.ciphertext(), encrypted.nonce(), Timestamp.from(updatedAt), userId, id) == 0)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        return response(body, id, updatedAt);
    }

    @Transactional
    public void delete(Long userId, Long id) { jdbc.update("delete from resume_draft where user_id=? and id=?", userId, id); }

    public void consume(Long userId, Long draftId, String purpose, Long resumeId, Long versionId) {
        var rows = jdbc.query("select content_ciphertext, content_nonce from resume_draft where user_id=? and id=? for update",
                (rs, row) -> new byte[][] { rs.getBytes(1), rs.getBytes(2) }, userId, draftId);
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        JsonNode value;
        try { value = json.readTree(cipher.decryptDraft(userId, rows.get(0)[0], rows.get(0)[1])); }
        catch (JsonProcessingException exception) { throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "저장된 임시저장을 읽을 수 없습니다."); }
        if ("resume".equals(purpose)) {
            if (value.path("version").asInt() != 1) throw badInput();
        } else if (value.path("version").asInt() != 2 || !purpose.equals(value.path("purpose").asText())
                || value.path("resumeId").asLong() != resumeId
                || ("version-edit".equals(purpose) && value.path("versionId").asLong() != versionId)) throw badInput();
        jdbc.update("delete from resume_draft where user_id=? and id=?", userId, draftId);
    }

    private void validateTarget(Long userId, JsonNode body) {
        if (body.path("version").asInt() != 2) return;
        long resumeId = body.path("resumeId").asLong();
        if (jdbc.queryForObject("select count(*) from resume where id=? and user_id=? and deleted_at is null",
                Long.class, resumeId, userId) == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        if ("version-edit".equals(body.path("purpose").asText()) && jdbc.queryForObject(
                "select count(*) from resume_version where id=? and resume_id=?", Long.class,
                body.path("versionId").asLong(), resumeId) == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    }

    private String payload(JsonNode body) {
        String payload;
        try { payload = json.writeValueAsString(body); }
        catch (JsonProcessingException exception) { throw badInput(); }
        if (payload.getBytes(StandardCharsets.UTF_8).length > 262_144) throw badInput();
        return payload;
    }

    private ObjectNode response(JsonNode value, Long id, Instant updatedAt) {
        var response = ((ObjectNode) value).deepCopy();
        response.put("id", id);
        response.put("updatedAt", updatedAt.toString());
        return response;
    }

    static void validate(JsonNode body) {
        if (body == null || !body.isObject() || body.get("version") == null
                || !body.get("version").isIntegralNumber() || !Set.of(1, 2).contains(body.get("version").intValue())
                || body.get("mode") == null || !body.get("mode").isTextual()
                || !Set.of("free", "template").contains(body.get("mode").textValue())
                || !text(body.get("title"), body.get("version").intValue() == 1 ? 200 : 50)
                || !text(body.get("content"), 100_000)
                || body.get("form") == null || !body.get("form").isObject()) throw badInput();
        boolean versionDraft = body.get("version").intValue() == 2;
        if (versionDraft) {
            if (!body.has("purpose") || !body.get("purpose").isTextual()
                    || !Set.of("version-new", "version-edit").contains(body.get("purpose").textValue())
                    || !body.has("resumeId") || !positiveId(body.get("resumeId"))
                    || !text(body.get("description"), 200)
                    || ("version-edit".equals(body.get("purpose").textValue()) != body.has("versionId"))
                    || (body.has("versionId") && !positiveId(body.get("versionId")))) throw badInput();
        } else if (body.size() != 5) throw badInput();
        var fields = body.fieldNames();
        var allowedFields = versionDraft ? Set.of("version", "mode", "title", "content", "form", "purpose", "resumeId", "versionId", "description")
                : Set.of("version", "mode", "title", "content", "form");
        while (fields.hasNext()) if (!allowedFields.contains(fields.next())) throw badInput();
        if (versionDraft && body.size() != (body.has("versionId") ? 9 : 8)) throw badInput();
        var form = body.get("form");
        var scalars = Set.of("name", "phone", "email", "birth", "desiredRole", "location", "employment",
                "introduction", "link", "blog", "extra");
        var arrays = Set.of("education", "skills", "projects", "experience", "certificates", "training", "links");
        var names = form.fieldNames();
        while (names.hasNext()) {
            String name = names.next();
            if (!scalars.contains(name) && !arrays.contains(name)) throw badInput();
        }
        for (String name : scalars) {
            if (name.equals("blog") && form.get(name) == null) continue;
            if (!text(form.get(name), 10_000)) throw badInput();
        }
        for (String name : arrays) {
            var items = form.get(name);
            if ((name.equals("training") || name.equals("links")) && items == null) continue;
            if (items == null || !items.isArray() || items.size() > 100) throw badInput();
            for (JsonNode item : items) {
                if (name.equals("skills") || name.equals("links")) { if (!text(item, 10_000)) throw badInput(); }
                else if (!item.isObject()) throw badInput();
                else {
                    var allowed = switch (name) {
                        case "education" -> Set.of("school", "major", "degree", "start", "end");
                        case "projects" -> Set.of("name", "start", "end", "description", "role", "skills", "work");
                        case "experience" -> Set.of("company", "start", "end", "current", "role", "work");
                        case "training" -> Set.of("name", "provider", "start", "end", "content");
                        default -> Set.of("name", "date", "issuer");
                    };
                    if (item.size() != allowed.size()) throw badInput();
                    var itemNames = item.fieldNames();
                    while (itemNames.hasNext()) if (!allowed.contains(itemNames.next())) throw badInput();
                    for (String field : allowed) {
                        if (field.equals("current")) {
                            if (!item.path(field).isBoolean()) throw badInput();
                        } else if (!text(item.get(field), 10_000)) throw badInput();
                    }
                }
            }
        }
    }

    private static boolean text(JsonNode node, int max) {
        return node != null && node.isTextual() && node.textValue().length() <= max
                && node.textValue().codePoints().noneMatch(c -> Character.isISOControl(c) && c != '\n' && c != '\r' && c != '\t');
    }
    private static boolean positiveId(JsonNode node) { return node.isIntegralNumber() && node.canConvertToLong() && node.longValue() > 0; }

    private static ResponseStatusException badInput() { return new ResponseStatusException(HttpStatus.BAD_REQUEST); }
    private record DraftRow(Long id, byte[] ciphertext, byte[] nonce, Instant updatedAt) { }
}
