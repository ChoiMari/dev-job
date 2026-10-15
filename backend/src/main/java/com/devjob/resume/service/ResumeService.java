package com.devjob.resume.service;

import com.devjob.resume.dto.*;
import com.devjob.resume.entity.*;
import com.devjob.resume.repository.*;
import com.devjob.documentanalysis.repository.DocumentAnalysisRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import com.devjob.user.repository.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
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

    public ResumeService(ResumeRepository resumes, ResumeVersionRepository versions, UserRepository users, ResumeCipher cipher,
            DocumentAnalysisRepository analyses, JdbcTemplate jdbc) {
        this.resumes = resumes; this.versions = versions; this.users = users; this.cipher = cipher; this.analyses = analyses;
        this.jdbc = jdbc;
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
        fields(body, Set.of("title", "content"), Set.of("title", "content"));
        String title = text(body.get("title"), 200);
        String content = text(body.get("content"), 100_000);
        var user = users.findById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        jdbc.queryForObject("select id from users where id=? for update", Long.class, userId);
        if (jdbc.queryForObject("select count(*) from resume where user_id=? and deleted_at is null", Long.class, userId) >= 20)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "이력서는 최대 20개까지 등록할 수 있습니다.");
        var resume = resumes.saveAndFlush(new Resume(user, title));
        var encrypted = cipher.encrypt(resume.getId(), 1, content);
        var version = versions.saveAndFlush(new ResumeVersion(resume, 1, encrypted.ciphertext(), encrypted.nonce()));
        return ResumeResponse.from(resume, version);
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
        fields(body, Set.of("content"), Set.of("content"));
        String content = text(body.get("content"), 100_000);
        var resume = owned(userId, id, true);
        int number = Math.addExact(latest(id).getVersionNumber(), 1);
        var encrypted = cipher.encrypt(id, number, content);
        var version = versions.saveAndFlush(new ResumeVersion(resume, number, encrypted.ciphertext(), encrypted.nonce()));
        resume.versionAdded();
        resumes.flush();
        return ResumeVersionResponse.metadata(version);
    }

    @Transactional(readOnly = true)
    public ResumeVersionResponse version(Long userId, Long id, Long versionId) {
        owned(userId, id, false);
        positive(versionId);
        var version = versions.owned(versionId, id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return ResumeVersionResponse.detail(version, cipher.decrypt(id, version.getVersionNumber(),
                version.getContentCiphertext(), version.getContentNonce()));
    }

    private ResumeResponse response(Resume resume) { return ResumeResponse.from(resume, latest(resume.getId())); }
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
    private static ResponseStatusException badInput() { return new ResponseStatusException(HttpStatus.BAD_REQUEST); }
}
