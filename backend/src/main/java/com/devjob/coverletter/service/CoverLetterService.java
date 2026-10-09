package com.devjob.coverletter.service;

import com.devjob.coverletter.dto.*;
import com.devjob.coverletter.entity.*;
import com.devjob.coverletter.repository.*;
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
public class CoverLetterService {
    private final CoverLetterRepository coverLetters;
    private final CoverLetterVersionRepository versions;
    private final UserRepository users;
    private final CoverLetterCipher cipher;
    private final DocumentAnalysisRepository analyses;
    private final JdbcTemplate jdbc;

    public CoverLetterService(CoverLetterRepository coverLetters, CoverLetterVersionRepository versions, UserRepository users,
            CoverLetterCipher cipher, DocumentAnalysisRepository analyses, JdbcTemplate jdbc) {
        this.coverLetters = coverLetters; this.versions = versions; this.users = users; this.cipher = cipher; this.analyses = analyses;
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public Page<CoverLetterResponse> list(Long userId, int page, int size) {
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE) throw badInput();
        return coverLetters.list(userId, PageRequest.of(page, size)).map(this::response);
    }

    @Transactional(readOnly = true)
    public CoverLetterResponse get(Long userId, Long id) { return response(owned(userId, id, false)); }

    @Transactional
    public CoverLetterResponse create(Long userId, JsonNode body) {
        fields(body, Set.of("title", "content"), Set.of("title", "content"));
        String title = text(body.get("title"), 200);
        String content = text(body.get("content"), 100_000);
        var user = users.findById(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        var coverLetter = coverLetters.saveAndFlush(new CoverLetter(user, title));
        var encrypted = cipher.encrypt(coverLetter.getId(), 1, content);
        var version = versions.saveAndFlush(new CoverLetterVersion(coverLetter, 1, encrypted.ciphertext(), encrypted.nonce()));
        return CoverLetterResponse.from(coverLetter, version);
    }

    @Transactional
    public CoverLetterResponse rename(Long userId, Long id, JsonNode body) {
        fields(body, Set.of("title"), Set.of("title"));
        String title = text(body.get("title"), 200);
        var coverLetter = owned(userId, id, true);
        if (!coverLetter.getTitle().equals(title)) coverLetter.rename(title);
        coverLetters.flush();
        return response(coverLetter);
    }

    @Transactional
    public void delete(Long userId, Long id) {
        var coverLetter = owned(userId, id, true);
        jdbc.update("delete from semantic_recommendation where cover_letter_version_id in "
                + "(select id from cover_letter_version where cover_letter_id=?)", id);
        analyses.deleteForCoverLetter(id);
        coverLetter.delete();
        coverLetters.flush();
    }

    @Transactional(readOnly = true)
    public java.util.List<CoverLetterVersionResponse> versions(Long userId, Long id) {
        owned(userId, id, false);
        return versions.list(id).stream().map(CoverLetterVersionResponse::metadata).toList();
    }

    @Transactional
    public CoverLetterVersionResponse addVersion(Long userId, Long id, JsonNode body) {
        fields(body, Set.of("content"), Set.of("content"));
        String content = text(body.get("content"), 100_000);
        var coverLetter = owned(userId, id, true);
        int number = Math.addExact(latest(id).getVersionNumber(), 1);
        var encrypted = cipher.encrypt(id, number, content);
        var version = versions.saveAndFlush(new CoverLetterVersion(coverLetter, number, encrypted.ciphertext(), encrypted.nonce()));
        coverLetter.versionAdded();
        coverLetters.flush();
        return CoverLetterVersionResponse.metadata(version);
    }

    @Transactional(readOnly = true)
    public CoverLetterVersionResponse version(Long userId, Long id, Long versionId) {
        owned(userId, id, false);
        positive(versionId);
        var version = versions.owned(versionId, id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return CoverLetterVersionResponse.detail(version, cipher.decrypt(id, version.getVersionNumber(),
                version.getContentCiphertext(), version.getContentNonce()));
    }

    private CoverLetterResponse response(CoverLetter coverLetter) { return CoverLetterResponse.from(coverLetter, latest(coverLetter.getId())); }
    private CoverLetterVersion latest(Long id) { return versions.latest(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND)); }
    private CoverLetter owned(Long userId, Long id, boolean lock) {
        positive(id);
        var coverLetter = (lock ? coverLetters.findForUpdate(id) : coverLetters.findById(id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (coverLetter.getDeletedAt() != null) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        if (!coverLetter.getUserId().equals(userId)) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        return coverLetter;
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
