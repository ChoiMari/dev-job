package com.devjob.recommendation;

import com.devjob.coverletter.service.CoverLetterCipher;
import com.devjob.resume.service.ResumeCipher;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Executor;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

@Service
public class RecommendationService {
    private static final String POLICY_VERSION = "B14_V2";
    private static final String MODEL_NAME = "gpt-5.4-mini";
    public record Candidate(String kind, long id, String title, String description, Instant updatedAt,
            LocalDate deadlineDate, boolean applied, String status, String reason) { }
    public record Document(String kind, long documentId, long versionId, String content, boolean stale) { }
    public record Item(String kind, long id, String title, String status, String reason, Integer rank,
            List<Evidence> evidence, List<String> limitations, List<PreparationTip> preparationTips) { }
    public record PreparationTip(String type, String basisQuote, String text) { }
    public record DisplayItem(String kind, long id, String title, String status, String reason, Integer rank,
            List<Evidence> evidence, List<String> limitations, String companyName, String location,
            LocalDate deadlineDate, List<String> skillTags, List<PreparationTip> preparationTips) { }
    private record DisplayMeta(String companyName, String location, LocalDate deadlineDate, List<String> skillTags) { }
    public record Evidence(String documentQuote, String jobQuote, String explanation) { }
    public record Page(long id, String status, boolean stale, String failureReason, Instant consentedAt,
            Instant analyzedAt, String policyVersion, String modelName, Long resumeVersionId,
            Long coverLetterVersionId, int candidateCount, List<DisplayItem> items, int page, int size, int totalElements,
            String limitation) { }
    public record RequestResult(Page body, boolean accepted) { }
    public record HistoryItem(long id, String status, Instant consentedAt, Instant analyzedAt,
            int candidateCount, Long resumeVersionId, Long coverLetterVersionId) { }
    public record HistoryPage(List<HistoryItem> items, int page, int size, long totalElements) { }
    private record Row(long id, long userId, Long resumeVersionId, Long coverVersionId, String status,
            String policyVersion, String modelName, String candidates, byte[] ciphertext, byte[] nonce, String failureReason, Instant consentedAt,
            Instant analyzedAt, Instant updatedAt) { }
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final ResumeCipher resumeCipher;
    private final CoverLetterCipher coverCipher;
    private final RecommendationCipher cipher;
    private final RecommendationGateway gateway;
    private final RecommendationRunner runner;
    private final Executor executor;

    public RecommendationService(JdbcTemplate jdbc, ObjectMapper mapper, ResumeCipher resumeCipher,
            CoverLetterCipher coverCipher, RecommendationCipher cipher,
            RecommendationGateway gateway, RecommendationRunner runner,
            @Qualifier("analysisExecutor") Executor executor) {
        this.jdbc = jdbc; this.mapper = mapper; this.resumeCipher = resumeCipher; this.coverCipher = coverCipher;
        this.cipher = cipher; this.gateway = gateway; this.runner = runner; this.executor = executor;
    }

    @Transactional
    public RequestResult request(long userId, JsonNode body) {
        // Serialize identical requests before the unique input key is checked.
        if (jdbc.query("select id from users where id=? for update", (rs, n) -> rs.getLong(1), userId).isEmpty())
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        if (body == null || !body.isObject() || body.size() != 4
                || !body.path("consentToExternalComparison").isBoolean()
                || !body.path("consentToExternalComparison").booleanValue()) bad();
        var names = body.fieldNames();
        while (names.hasNext()) if (!Set.of("consentToExternalComparison", "resumeVersionId",
                "coverLetterVersionId", "candidates").contains(names.next())) bad();
        Long resumeId = positiveOptional(body.get("resumeVersionId"));
        Long coverId = positiveOptional(body.get("coverLetterVersionId"));
        if (resumeId == null && coverId == null) bad();
        JsonNode requested = body.get("candidates");
        if (requested == null || !requested.isArray() || requested.size() > 20) bad();
        var documents = new ArrayList<Document>();
        if (resumeId != null) documents.add(document(userId, "RESUME", resumeId));
        if (coverId != null) documents.add(document(userId, "COVER_LETTER", coverId));
        var candidates = new ArrayList<Candidate>();
        Set<String> keys = new HashSet<>();
        for (JsonNode input : requested) {
            if (!input.isObject() || input.size() != 2 || !input.path("kind").isTextual()
                    || !input.path("id").canConvertToLong()) bad();
            String kind = input.path("kind").textValue();
            long id = input.path("id").longValue();
            if (id < 1 || !Set.of("COLLECTED", "MANUAL").contains(kind) || !keys.add(kind + ":" + id)) bad();
            lockCandidate(userId, kind, id);
            candidates.add(candidate(userId, kind, id));
        }
        candidates.sort(Comparator.comparing(Candidate::kind).thenComparingLong(Candidate::id));
        String fingerprint = hash(userId, documents, candidates);
        var old = jdbc.query("select * from semantic_recommendation where user_id=? and input_hash=? for update",
                this::row, userId, fingerprint).stream().findFirst();
        if (old.isPresent()) {
            Row row = old.get();
            if ("COMPLETED".equals(row.status()) && !stale(row)) return new RequestResult(page(row, 0, 20), false);
            if ("PENDING".equals(row.status()) && Duration.between(row.updatedAt(), Instant.now()).compareTo(Duration.ofMinutes(5)) < 0)
                return new RequestResult(page(row, 0, 20), true);
        }
        boolean runnable = candidates.stream().anyMatch(c -> "READY".equals(c.status()));
        if (!cipher.available() || (runnable && !gateway.available()))
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE);
        Instant now = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        String snapshot = json(candidates.stream().map(c -> new Candidate(c.kind(), c.id(), c.title(), null,
                c.updatedAt(), c.deadlineDate(), c.applied(), c.status(), c.reason())).toList());
        long id;
        if (old.isPresent()) {
            id = old.get().id();
            jdbc.update("update semantic_recommendation set status='PENDING', candidates=?::jsonb, "
                    + "result_ciphertext=null, result_nonce=null, failure_reason=null, consented_at=?, analyzed_at=null, updated_at=? where id=?",
                    snapshot, Timestamp.from(now), Timestamp.from(now), id);
        } else {
            id = jdbc.queryForObject("insert into semantic_recommendation "
                    + "(user_id,resume_version_id,cover_letter_version_id,input_hash,policy_version,model_name,status,candidates,consented_at,updated_at) "
                    + "values (?,?,?,?,?,?, 'PENDING', ?::jsonb, ?, ?) returning id", Long.class,
                    userId, resumeId, coverId, fingerprint, POLICY_VERSION, MODEL_NAME, snapshot, Timestamp.from(now), Timestamp.from(now));
        }
        if (runnable) {
            var docs = List.copyOf(documents);
            var jobs = List.copyOf(candidates);
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() {
                    try { executor.execute(() -> runner.run(id, now, docs, jobs)); }
                    catch (RuntimeException ignored) { runner.fail(id, now); }
                }
            });
        } else {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { runner.completeWithoutAi(id, now, List.copyOf(candidates)); }
            });
        }
        return new RequestResult(page(rowFor(userId, id), 0, 20), true);
    }

    @Transactional(readOnly = true)
    public Page get(long userId, long id, int page, int size) {
        if (id < 1 || page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE) bad();
        return page(rowFor(userId, id), page, size);
    }
    @Transactional(readOnly = true)
    public HistoryPage history(long userId, int page, int size) {
        if (page < 0 || size < 1 || size > 50 || (long) page * size > Integer.MAX_VALUE) bad();
        long total = jdbc.queryForObject("select count(*) from semantic_recommendation where user_id=?", Long.class, userId);
        var items = jdbc.query("select id,status,consented_at,analyzed_at,jsonb_array_length(candidates),"
                + "resume_version_id,cover_letter_version_id from semantic_recommendation where user_id=? "
                + "order by consented_at desc,id desc limit ? offset ?", (rs, n) -> new HistoryItem(
                rs.getLong(1), rs.getString(2), rs.getTimestamp(3).toInstant(),
                rs.getTimestamp(4) == null ? null : rs.getTimestamp(4).toInstant(), rs.getInt(5),
                rs.getObject(6, Long.class), rs.getObject(7, Long.class)), userId, size, page * size);
        return new HistoryPage(items, page, size, total);
    }
    private Page page(Row row, int page, int size) {
        var candidates = parseCandidates(row.candidates());
        List<Item> items;
        if ("COMPLETED".equals(row.status())) {
            try {
                items = mapper.readerForListOf(Item.class).readValue(cipher.decrypt(row.id(), row.ciphertext(), row.nonce()));
            } catch (Exception exception) { throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE); }
        } else items = candidates.stream().map(c -> new Item(c.kind(), c.id(), c.title(),
                "FAILED".equals(row.status()) ? "FAILED" : "PENDING", null, null, List.of(), List.of(), List.of())).toList();
        int from = (int) Math.min(items.size(), (long) page * size);
        int to = Math.min(items.size(), from + size);
        return new Page(row.id(), row.status(), stale(row), row.failureReason(), row.consentedAt(), row.analyzedAt(),
                row.policyVersion(), row.modelName(), row.resumeVersionId(), row.coverVersionId(),
                candidates.size(), displayItems(row.userId(), items.subList(from, to)), page, size, items.size(),
                "AI가 제공된 텍스트에서 찾은 근거로 정렬한 참고 결과이며 합격 확률이나 채용 결과 예측이 아닙니다. "
                        + "문서는 각 12,000자, 공고 본문은 각 4,000자로 잘릴 수 있으며 누락 정보와 AI 오류가 있을 수 있습니다.");
    }
    private List<DisplayItem> displayItems(long userId, List<Item> items) {
        if (items.isEmpty()) return List.of();
        Map<String, DisplayMeta> metadata = new HashMap<>();
        var collected = items.stream().filter(i -> "COLLECTED".equals(i.kind())).map(Item::id).distinct().toList();
        var manual = items.stream().filter(i -> "MANUAL".equals(i.kind())).map(Item::id).distinct().toList();
        if (!collected.isEmpty()) {
            String placeholders = String.join(",", Collections.nCopies(collected.size(), "?"));
            jdbc.query("select j.id,c.name,j.location,j.deadline_date from job_posting j join company c on c.id=j.company_id "
                    + "where j.id in (" + placeholders + ")", rs -> {
                metadata.put("COLLECTED:" + rs.getLong(1), new DisplayMeta(rs.getString(2), rs.getString(3),
                        rs.getObject(4, LocalDate.class), List.of()));
            }, collected.toArray());
            Map<Long, LinkedHashSet<String>> tags = new HashMap<>();
            jdbc.query("select js.job_posting_id,s.name from job_skill js join skill s on s.id=js.skill_id "
                    + "join ai_analysis a on a.job_posting_id=js.job_posting_id and a.status='COMPLETED' "
                    + "where js.job_posting_id in (" + placeholders + ") "
                    + "order by js.job_posting_id,case js.requirement_type when 'REQUIRED' then 0 else 1 end,s.name", rs -> {
                tags.computeIfAbsent(rs.getLong(1), ignored -> new LinkedHashSet<>()).add(rs.getString(2));
            }, collected.toArray());
            for (long id : collected) {
                String key = "COLLECTED:" + id;
                DisplayMeta meta = metadata.get(key);
                if (meta != null) metadata.put(key, new DisplayMeta(meta.companyName(), meta.location(),
                        meta.deadlineDate(), List.copyOf(tags.getOrDefault(id, new LinkedHashSet<>()))));
            }
        }
        if (!manual.isEmpty()) {
            String placeholders = String.join(",", Collections.nCopies(manual.size(), "?"));
            List<Object> args = new ArrayList<>(); args.add(userId); args.addAll(manual);
            jdbc.query("select p.id,p.company_name,p.location,p.deadline_date from personal_saved_job p "
                    + "where p.user_id=? and p.deleted_at is null and p.id in (" + placeholders + ")", rs -> {
                metadata.put("MANUAL:" + rs.getLong(1), new DisplayMeta(rs.getString(2), rs.getString(3),
                        rs.getObject(4, LocalDate.class), List.of()));
            }, args.toArray());
            jdbc.query("select a.personal_saved_job_id,a.result_json::text from personal_saved_job_analysis a "
                    + "join personal_saved_job p on p.id=a.personal_saved_job_id "
                    + "where p.user_id=? and p.deleted_at is null and a.status='COMPLETED' "
                    + "and a.personal_saved_job_id in (" + placeholders + ")", rs -> {
                String key = "MANUAL:" + rs.getLong(1);
                DisplayMeta meta = metadata.get(key);
                if (meta == null) return;
                try {
                    JsonNode result = mapper.readTree(rs.getString(2));
                    LinkedHashSet<String> tags = new LinkedHashSet<>();
                    for (String field : List.of("requiredSkills", "preferredSkills"))
                        for (JsonNode skill : result.path(field)) if (skill.isTextual()) tags.add(skill.textValue());
                    metadata.put(key, new DisplayMeta(meta.companyName(), meta.location(), meta.deadlineDate(),
                            List.copyOf(tags)));
                } catch (Exception ignored) { /* Metadata must not prevent reading a saved comparison. */ }
            }, args.toArray());
        }
        return items.stream().map(item -> {
            DisplayMeta meta = metadata.get(item.kind() + ":" + item.id());
            return new DisplayItem(item.kind(), item.id(), item.title(), item.status(), item.reason(), item.rank(),
                    item.evidence(), item.limitations(), meta == null ? null : meta.companyName(),
                    meta == null ? null : meta.location(), meta == null ? null : meta.deadlineDate(),
                    meta == null ? List.of() : meta.skillTags(),
                    item.preparationTips() == null ? List.of() : item.preparationTips());
        }).toList();
    }
    private boolean stale(Row row) {
        if (row.resumeVersionId() != null && jdbc.queryForObject("""
                select count(*) from resume_version v join resume r on r.id=v.resume_id
                where v.id=? and r.user_id=? and r.deleted_at is null and
                  v.id=(select id from resume_version where resume_id=r.id order by version_number desc limit 1)
                """, Integer.class, row.resumeVersionId(), row.userId()) == 0) return true;
        if (row.coverVersionId() != null && jdbc.queryForObject("""
                select count(*) from cover_letter_version v join cover_letter c on c.id=v.cover_letter_id
                where v.id=? and c.user_id=? and c.deleted_at is null and
                  v.id=(select id from cover_letter_version where cover_letter_id=c.id order by version_number desc limit 1)
                """, Integer.class, row.coverVersionId(), row.userId()) == 0) return true;
        for (Candidate c : parseCandidates(row.candidates())) {
            try {
                Candidate current = candidate(row.userId(), c.kind(), c.id());
                if (!current.updatedAt().equals(c.updatedAt()) || !current.status().equals(c.status())
                        || !java.util.Objects.equals(current.reason(), c.reason())) return true;
            } catch (ResponseStatusException exception) { return true; }
        }
        return false;
    }
    private Document document(long userId, String kind, long versionId) {
        String sql = "RESUME".equals(kind) ? """
                select r.id, v.version_number, v.content_ciphertext, v.content_nonce,
                  (select id from resume_version where resume_id=r.id order by version_number desc limit 1) as latest
                from resume_version v join resume r on r.id=v.resume_id
                where v.id=? and r.user_id=? and r.deleted_at is null for share of r
                """ : """
                select c.id, v.version_number, v.content_ciphertext, v.content_nonce,
                  (select id from cover_letter_version where cover_letter_id=c.id order by version_number desc limit 1) as latest
                from cover_letter_version v join cover_letter c on c.id=v.cover_letter_id
                where v.id=? and c.user_id=? and c.deleted_at is null for share of c
                """;
        return jdbc.query(sql, (rs, n) -> {
            long documentId = rs.getLong("id");
            int number = rs.getInt("version_number");
            String content = "RESUME".equals(kind)
                    ? resumeCipher.decrypt(documentId, number, rs.getBytes("content_ciphertext"), rs.getBytes("content_nonce"))
                    : coverCipher.decrypt(documentId, number, rs.getBytes("content_ciphertext"), rs.getBytes("content_nonce"));
            return new Document(kind, documentId, versionId, content, rs.getLong("latest") != versionId);
        }, versionId, userId).stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
    private Candidate candidate(long userId, String kind, long id) {
        String sql = "MANUAL".equals(kind) ? """
                select p.title,p.description,p.updated_at,p.deadline_date,
                  exists(select 1 from application a where a.user_id=? and a.personal_saved_job_id=p.id and a.deleted_at is null) as applied
                from personal_saved_job p where p.id=? and p.user_id=? and p.deleted_at is null
                """ : """
                select j.title,j.description,j.updated_at,j.deadline_date,
                  exists(select 1 from application a where a.user_id=? and a.job_posting_id=j.id and a.deleted_at is null) as applied
                from job_posting j where j.id=?
                """;
        var found = jdbc.query(sql, (rs, n) -> {
            String description = rs.getString("description");
            LocalDate deadline = rs.getObject("deadline_date", LocalDate.class);
            boolean applied = rs.getBoolean("applied");
            String reason = applied ? "ALREADY_APPLIED" : deadline != null
                    && deadline.isBefore(LocalDate.now(java.time.ZoneId.of("Asia/Seoul")))
                    ? "EXPIRED" : description == null || description.isBlank() ? "INSUFFICIENT_INPUT" : null;
            return new Candidate(kind, id, rs.getString("title"), description, rs.getTimestamp("updated_at").toInstant(),
                    deadline, applied, reason == null ? "READY" : "UNAVAILABLE", reason);
        }, "MANUAL".equals(kind) ? new Object[]{userId, id, userId} : new Object[]{userId, id});
        return found.stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
    private void lockCandidate(long userId, String kind, long id) {
        var found = "MANUAL".equals(kind)
                ? jdbc.query("select id from personal_saved_job where id=? and user_id=? and deleted_at is null for share",
                        (rs, n) -> rs.getLong(1), id, userId)
                : jdbc.query("select id from job_posting where id=? for share", (rs, n) -> rs.getLong(1), id);
        if (found.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    }
    private Row rowFor(long userId, long id) {
        return jdbc.query("select * from semantic_recommendation where id=? and user_id=?", this::row, id, userId)
                .stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
    private Row row(java.sql.ResultSet rs, int n) throws java.sql.SQLException {
        return new Row(rs.getLong("id"), rs.getLong("user_id"), rs.getObject("resume_version_id", Long.class),
                rs.getObject("cover_letter_version_id", Long.class), rs.getString("status"),
                rs.getString("policy_version"), rs.getString("model_name"), rs.getString("candidates"),
                rs.getBytes("result_ciphertext"), rs.getBytes("result_nonce"), rs.getString("failure_reason"),
                rs.getTimestamp("consented_at").toInstant(), rs.getTimestamp("analyzed_at") == null ? null
                        : rs.getTimestamp("analyzed_at").toInstant(), rs.getTimestamp("updated_at").toInstant());
    }
    private List<Candidate> parseCandidates(String value) {
        try { return mapper.readerForListOf(Candidate.class).readValue(value); }
        catch (Exception exception) { throw new IllegalStateException("Invalid recommendation snapshot"); }
    }
    private String hash(long userId, List<Document> docs, List<Candidate> candidates) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update((POLICY_VERSION + MODEL_NAME + userId).getBytes(StandardCharsets.UTF_8));
            for (Document doc : docs) digest.update((doc.kind() + doc.versionId() + doc.content()).getBytes(StandardCharsets.UTF_8));
            for (Candidate job : candidates) digest.update((job.kind() + job.id() + job.title() + job.description()
                    + job.updatedAt() + job.deadlineDate() + job.applied() + job.status() + job.reason())
                    .getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest.digest());
        } catch (Exception exception) { throw new IllegalStateException(exception); }
    }
    private String json(Object value) {
        try { return mapper.writeValueAsString(value); }
        catch (Exception exception) { throw new IllegalStateException(exception); }
    }
    private static Long positiveOptional(JsonNode node) {
        if (node == null || node.isNull()) return null;
        if (!node.canConvertToLong() || node.longValue() < 1) bad();
        return node.longValue();
    }
    private static void bad() { throw new ResponseStatusException(HttpStatus.BAD_REQUEST); }
}
