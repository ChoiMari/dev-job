package com.devjob.resume.service;

import com.devjob.resume.dto.*;
import com.devjob.resume.entity.*;
import com.devjob.resume.repository.*;
import com.devjob.documentanalysis.repository.DocumentAnalysisRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import com.devjob.user.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.Set;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ResumeService {
    private final ResumeRepository resumes;
    private final ResumeVersionRepository versions;
    private final UserRepository users;
    private final ResumeCipher cipher;
    private final DocumentAnalysisRepository analyses;
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final ResumeDraftService drafts;

    public ResumeService(ResumeRepository resumes, ResumeVersionRepository versions, UserRepository users, ResumeCipher cipher,
            DocumentAnalysisRepository analyses, JdbcTemplate jdbc, ObjectMapper json, ResumeDraftService drafts) {
        this.resumes = resumes; this.versions = versions; this.users = users; this.cipher = cipher; this.analyses = analyses;
        this.jdbc = jdbc; this.json = json; this.drafts = drafts;
    }

    @Transactional(readOnly = true)
    public Page<ResumeResponse> list(Long userId, int page, int size) {
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE) throw badInput();
        return resumes.list(userId, PageRequest.of(page, size)).map(this::response);
    }

    @Transactional(readOnly = true)
    public ResumeResponse get(Long userId, Long id) { return response(owned(userId, id, false)); }

    @Transactional
    public ResumeResponse create(Long userId, JsonNode body) {
        fields(body, Set.of("title", "content", "draftId", "form"), Set.of("title", "content"));
        String title = text(body.get("title"), 200);
        String content = text(body.get("content"), 100_000);
        String form = body.has("form") ? formPayload(body.get("form")) : null;
        Long draftId = draftId(body);
        var user = users.findById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        jdbc.queryForObject("select id from users where id=? for update", Long.class, userId);
        if (draftId != null && jdbc.queryForObject("select count(*) from resume_draft where user_id=? and id=?",
                Long.class, userId, draftId) == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        if (jdbc.queryForObject("select count(*) from resume where user_id=? and deleted_at is null", Long.class, userId) >= 20)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이력서는 최대 20개까지 등록할 수 있습니다.");
        var resume = resumes.saveAndFlush(new Resume(user, title));
        var encrypted = cipher.encrypt(resume.getId(), 1, content);
        var version = versions.saveAndFlush(new ResumeVersion(resume, 1, encrypted.ciphertext(), encrypted.nonce()));
        if (form != null) {
            var encryptedForm = cipher.encryptForm(resume.getId(), 1, form);
            version.setForm(encryptedForm.ciphertext(), encryptedForm.nonce());
            versions.flush();
        }
        if (draftId != null) drafts.consume(userId, draftId, "resume", null, null);
        return ResumeResponse.from(resume, version, 1);
    }

    @Transactional
    public ResumeResponse rename(Long userId, Long id, JsonNode body) {
        fields(body, Set.of("title"), Set.of("title"));
        String title = text(body.get("title"), 200);
        var resume = owned(userId, id, true);
        if (!resume.getTitle().equals(title)) resume.rename(title);
        resumes.flush();
        return response(resume);
    }

    @Transactional
    public void delete(Long userId, Long id) {
        var resume = owned(userId, id, true);
        jdbc.update("delete from semantic_recommendation where resume_version_id in "
                + "(select id from resume_version where resume_id=?)", id);
        analyses.deleteForResume(id);
        resume.delete();
        resumes.flush();
    }

    @Transactional(readOnly = true)
    public java.util.List<ResumeVersionResponse> versions(Long userId, Long id) {
        owned(userId, id, false);
        return versions.list(id).stream().map(ResumeVersionResponse::metadata).toList();
    }

    @Transactional
    public ResumeVersionResponse addVersion(Long userId, Long id, JsonNode body) {
        fields(body, Set.of("content", "title", "description", "form", "draftId"), Set.of("content"));
        String content = text(body.get("content"), 100_000);
        String title = body.has("title") ? text(body.get("title"), 50) : null;
        String description = body.has("description") ? optionalText(body.get("description"), 200) : null;
        String form = body.has("form") ? formPayload(body.get("form")) : null;
        Long draftId = draftId(body);
        var resume = owned(userId, id, true);
        if (versions.countByResume_Id(id) >= 10)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이력서당 버전은 최대 10개까지 저장할 수 있습니다.");
        int number = Math.addExact(latest(id).getVersionNumber(), 1);
        var encrypted = cipher.encrypt(id, number, content);
        var version = versions.saveAndFlush(new ResumeVersion(resume, number, encrypted.ciphertext(), encrypted.nonce(), title, description));
        if (form != null) {
            var encryptedForm = cipher.encryptForm(id, number, form);
            version.setForm(encryptedForm.ciphertext(), encryptedForm.nonce());
            versions.flush();
        }
        resume.versionAdded();
        resumes.flush();
        if (draftId != null) drafts.consume(userId, draftId, "version-new", id, null);
        return ResumeVersionResponse.metadata(version);
    }

    @Transactional(readOnly = true)
    public ResumeVersionResponse version(Long userId, Long id, Long versionId) {
        owned(userId, id, false);
        positive(versionId);
        var version = versions.owned(versionId, id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return ResumeVersionResponse.detail(version, cipher.decrypt(id, version.getVersionNumber(),
                version.getContentCiphertext(), version.getContentNonce()), readForm(version));
    }

    @Transactional
    public ResumeVersionResponse editVersion(Long userId, Long id, Long versionId, JsonNode body) {
        fields(body, Set.of("content", "title", "description", "form", "draftId"), Set.of("content"));
        String content = text(body.get("content"), 100_000);
        String title = body.has("title") ? text(body.get("title"), 50) : null;
        String description = body.has("description") ? optionalText(body.get("description"), 200) : null;
        String form = body.has("form") ? formPayload(body.get("form")) : null;
        Long draftId = draftId(body);
        var resume = owned(userId, id, true);
        positive(versionId);
        var version = versions.owned(versionId, id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        jdbc.update("delete from semantic_recommendation where resume_version_id=?", versionId);
        analyses.findResumeForUpdate(versionId).ifPresent(analyses::delete);
        analyses.flush();
        var encrypted = cipher.encrypt(id, version.getVersionNumber(), content);
        var encryptedForm = form == null ? null : cipher.encryptForm(id, version.getVersionNumber(), form);
        version.replace(title, description, encrypted.ciphertext(), encrypted.nonce(),
                encryptedForm == null ? null : encryptedForm.ciphertext(), encryptedForm == null ? null : encryptedForm.nonce());
        resume.versionAdded();
        versions.flush();
        resumes.flush();
        if (draftId != null) drafts.consume(userId, draftId, "version-edit", id, versionId);
        return ResumeVersionResponse.metadata(version);
    }

    @Transactional
    public void deleteVersion(Long userId, Long id, Long versionId) {
        var resume = owned(userId, id, true);
        positive(versionId);
        var version = versions.owned(versionId, id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (versions.countByResume_Id(id) <= 1)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "마지막 버전은 삭제할 수 없습니다.");
        jdbc.update("delete from semantic_recommendation where resume_version_id=?", versionId);
        analyses.findResumeForUpdate(versionId).ifPresent(analyses::delete);
        analyses.flush();
        versions.delete(version);
        versions.flush();
        resume.versionAdded();
        resumes.flush();
    }

    private Long draftId(JsonNode body) {
        if (!body.has("draftId")) return null;
        if (!body.get("draftId").isIntegralNumber() || !body.get("draftId").canConvertToLong()) throw badInput();
        long id = body.get("draftId").longValue();
        positive(id);
        return id;
    }

    private String formPayload(JsonNode form) {
        var payload = json.createObjectNode();
        payload.put("version", 1).put("mode", "template").put("title", "").put("content", "");
        payload.set("form", form);
        ResumeDraftService.validate(payload);
        try {
            String serialized = json.writeValueAsString(form);
            if (serialized.getBytes(StandardCharsets.UTF_8).length > 262_144) throw badInput();
            return serialized;
        } catch (JsonProcessingException exception) { throw badInput(); }
    }

    private JsonNode readForm(ResumeVersion version) {
        if (version.getFormCiphertext() == null) return null;
        try {
            return json.readTree(cipher.decryptForm(version.getResumeId(), version.getVersionNumber(),
                    version.getFormCiphertext(), version.getFormNonce()));
        } catch (JsonProcessingException exception) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "저장된 이력서 양식을 읽을 수 없습니다.");
        }
    }

    private ResumeResponse response(Resume resume) { return ResumeResponse.from(resume, latest(resume.getId()), versions.countByResume_Id(resume.getId())); }
    private ResumeVersion latest(Long id) { return versions.latest(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND)); }
    private Resume owned(Long userId, Long id, boolean lock) {
        positive(id);
        var resume = (lock ? resumes.findForUpdate(id) : resumes.findById(id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (resume.getDeletedAt() != null) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        if (!resume.getUserId().equals(userId)) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        return resume;
    }
    private static void positive(Long id) { if (id == null || id <= 0) throw badInput(); }
    private static void fields(JsonNode body, Set<String> allowed, Set<String> required) {
        if (body == null || !body.isObject() || body.isEmpty()) throw badInput();
        Iterator<String> names = body.fieldNames();
        while (names.hasNext()) if (!allowed.contains(names.next())) throw badInput();
        for (String name : required) if (!body.has(name)) throw badInput();
    }
    private static String text(JsonNode node, int max) {
        if (node == null || !node.isTextual()) throw badInput();
        String value = node.textValue().strip();
        if (value.isEmpty() || value.length() > max || value.getBytes(StandardCharsets.UTF_8).length > 262_144
                || value.codePoints().anyMatch(c -> Character.isISOControl(c) && c != '\n' && c != '\r' && c != '\t')) throw badInput();
        return value;
    }
    private static String optionalText(JsonNode node, int max) {
        if (node == null || !node.isTextual()) throw badInput();
        String value = node.textValue().strip();
        return value.isEmpty() ? null : text(node, max);
    }
    private static ResponseStatusException badInput() { return new ResponseStatusException(HttpStatus.BAD_REQUEST); }
}
