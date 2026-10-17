package com.devjob.recommendation;

import com.devjob.documentanalysis.service.DocumentRedactor;
import com.devjob.notification.NotificationEventRecorder;
import com.devjob.recommendation.RecommendationService.Candidate;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class RecommendationRunnerTest {
    private final RecommendationRunner runner = new RecommendationRunner(mock(RecommendationGateway.class),
            mock(RecommendationCipher.class), new DocumentRedactor(), mock(JdbcTemplate.class), new ObjectMapper(),
            mock(NotificationEventRecorder.class), mock(PlatformTransactionManager.class));
    private final Candidate job = new Candidate("MANUAL", 7, "백엔드", "Java 서버 운영", Instant.now(),
            null, false, "READY", null);

    @Test void acceptsOnlySourceBackedEvidenceAndACompleteRank() throws Exception {
        String valid = """
                {"items":[{"kind":"MANUAL","id":7,"rank":1,"evidence":[
                  {"documentQuote":"Java 경험","jobQuote":"Java 서버","explanation":"기술 관련성"}],
                  "limitations":["경력 연수는 확인할 수 없음"],
                  "preparationTips":[{"type":"CHECK","basisQuote":"Java 서버",
                    "text":"실제 운영 환경에서 요구하는 업무 범위를 확인하세요."}]}]}
                """;
        assertThat(runner.validate(valid, List.of("Java 경험"), List.of(job))).singleElement()
                .satisfies(item -> {
                    assertThat(item.status()).isEqualTo("COMPLETED");
                    assertThat(item.rank()).isEqualTo(1);
                    assertThat(item.evidence().get(0).jobQuote()).isEqualTo("Java 서버");
                    assertThat(item.preparationTips()).singleElement().satisfies(tip -> {
                        assertThat(tip.type()).isEqualTo("CHECK");
                        assertThat(tip.basisQuote()).isEqualTo("Java 서버");
                    });
                });
        assertThatThrownBy(() -> runner.validate(valid.replace("Java 경험", "없는 경험"),
                List.of("Java 경험"), List.of(job))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> runner.validate(valid.replace("\"rank\":1", "\"rank\":2"),
                List.of("Java 경험"), List.of(job))).isInstanceOf(IllegalArgumentException.class);
        assertThat(runner.validate(valid.replace("\"basisQuote\":\"Java 서버\"",
                "\"basisQuote\":\"없는 요구사항\""), List.of("Java 경험"), List.of(job)).get(0).preparationTips())
                .isEmpty();
        assertThatThrownBy(() -> runner.validate(valid.replace("\"type\":\"CHECK\"",
                "\"type\":\"PREDICT\""), List.of("Java 경험"), List.of(job)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> runner.validate(valid.replace("실제 운영 환경", "010-1234-5678 운영 환경"),
                List.of("Java 경험"), List.of(job))).isInstanceOf(IllegalArgumentException.class);
        String extra = "{\"type\":\"CHECK\",\"basisQuote\":\"Java 서버\",\"text\":\"업무를 확인하세요.\"},";
        assertThatThrownBy(() -> runner.validate(valid.replace("\"preparationTips\":[",
                "\"preparationTips\":[" + extra.repeat(3)), List.of("Java 경험"), List.of(job)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(runner.validate(valid.replaceAll("(?s)\\\"preparationTips\\\":\\[.*?\\]", "\"preparationTips\":[]"),
                List.of("Java 경험"), List.of(job))).singleElement()
                .satisfies(item -> assertThat(item.preparationTips()).isEmpty());
    }

    @Test void storedOlderItemsWithoutPreparationTipsRemainReadable() throws Exception {
        var old = new ObjectMapper().readValue("""
                {"kind":"MANUAL","id":7,"title":"백엔드","status":"COMPLETED","reason":null,
                 "rank":1,"evidence":[],"limitations":[]}
                """, com.devjob.recommendation.RecommendationService.Item.class);
        assertThat(old.preparationTips()).isNull();
    }

    @Test void acceptsThreeDistinctPreparationCategoriesWithSourceQuotes() throws Exception {
        String raw = """
                {"items":[{"kind":"MANUAL","id":7,"rank":1,"evidence":[
                  {"documentQuote":"Java 경험","jobQuote":"Java 서버","explanation":"기술 관련성"}],
                  "limitations":["개발 환경은 알 수 없음"],"preparationTips":[
                    {"type":"CHECK","basisQuote":"Java 서버 운영","text":"사용하는 Java 버전을 확인해 보세요."},
                    {"type":"IMPROVE","basisQuote":"Java 경험","text":"담당한 API를 구체적으로 작성해 보세요."},
                    {"type":"PREPARE","basisQuote":"Java 경험","text":"설계와 문제 해결 경험을 면접 전에 정리해 보세요."}]}]}
                """;
        assertThat(runner.validate(raw, List.of("Java 경험"), List.of(job)).get(0).preparationTips())
                .extracting(tip -> tip.type()).containsExactly("CHECK", "IMPROVE", "PREPARE");
        assertThat(runner.validate(raw.replace("\"type\":\"PREPARE\"", "\"type\":\"CHECK\""),
                List.of("Java 경험"), List.of(job)).get(0).preparationTips())
                .extracting(tip -> tip.type()).containsExactly("CHECK", "IMPROVE");
        assertThatThrownBy(() -> runner.validate(raw.replace("\"type\":\"PREPARE\"", "\"type\":\"OTHER\""),
                List.of("Java 경험"), List.of(job))).isInstanceOf(IllegalArgumentException.class)
                .hasMessage("TIP_TYPE");
    }

    @Test void dropsOnlyUnmatchedPreparationQuoteAndKeepsSupportedTips() throws Exception {
        String raw = """
                {"items":[{"kind":"MANUAL","id":7,"rank":1,"evidence":[
                  {"documentQuote":"Java 경험","jobQuote":"Java 서버","explanation":"기술 관련성"}],
                  "limitations":["개발 환경은 알 수 없음"],"preparationTips":[
                    {"type":"CHECK","basisQuote":"공고에 없는 요구사항","text":"실제 요구사항을 확인하세요."},
                    {"type":"IMPROVE","basisQuote":"Java 경험","text":"담당한 API를 구체적으로 작성해 보세요."}]}]}
                """;
        var item = runner.validate(raw, List.of("Java 경험"), List.of(job)).get(0);
        assertThat(item.status()).isEqualTo("COMPLETED");
        assertThat(item.evidence()).hasSize(1);
        assertThat(item.preparationTips()).singleElement().satisfies(tip -> {
            assertThat(tip.type()).isEqualTo("IMPROVE");
            assertThat(tip.basisQuote()).isEqualTo("Java 경험");
        });
    }

    @Test void acceptsAdditionalRootMetadataButRequiresAllRequestedJobs() throws Exception {
        String raw = """
                {"items":[{"kind":"MANUAL","id":7,"rank":1,"evidence":[
                  {"documentQuote":"Java 경험","jobQuote":"Java 서버","explanation":"관련 경험"}],
                  "limitations":["상세 경력은 알 수 없음"],"preparationTips":[]}],
                  "summary":"모델의 추가 메타데이터"}
                """;
        assertThat(runner.validate(raw, List.of("Java 경험"), List.of(job))).hasSize(1);
        assertThatThrownBy(() -> runner.validate("{\"items\":[],\"summary\":\"extra\"}",
                List.of("Java 경험"), List.of(job))).isInstanceOf(IllegalArgumentException.class)
                .hasMessage("ROOT_COUNT");
        assertThatThrownBy(() -> runner.validate("{\"results\":[]}", List.of("Java 경험"), List.of(job)))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("ROOT_ITEMS");
    }

    @Test void keepsValidResultsAndShowsMissingCandidatesWithoutInventingAReason() throws Exception {
        String raw = """
                {"items":[{"kind":"MANUAL","id":7,"rank":2,"evidence":[
                  {"documentQuote":"Java 경험","jobQuote":"Java 서버","explanation":"관련 경험"}],
                  "limitations":["상세 경력은 알 수 없음"],"preparationTips":[]}]}
                """;
        var otherJob = new Candidate("MANUAL", 8, "프론트엔드", "React 개발", Instant.now(),
                null, false, "READY", null);
        var items = runner.validate(raw, List.of("Java 경험"), List.of(job, otherJob));
        assertThat(items).hasSize(2);
        assertThat(items.get(0).status()).isEqualTo("COMPLETED");
        assertThat(items.get(0).rank()).isEqualTo(1);
        assertThat(items.get(1).status()).isEqualTo("NO_RESULT");
        assertThat(items.get(1).rank()).isNull();
        assertThat(items.get(1).limitations()).isEmpty();
    }

    @Test void acceptsExplicitUnrelatedReasonAndDiscardsAnInvalidCandidateOnly() throws Exception {
        String raw = """
                {"items":[{"kind":"MANUAL","id":7,"outcome":"RANKED","rank":1,"evidence":[
                  {"documentQuote":"Java 경험","jobQuote":"Java 서버","explanation":"관련 경험"}],
                  "limitations":["상세 경력은 알 수 없음"],"preparationTips":[]},
                  {"kind":"MANUAL","id":8,"outcome":"UNRELATED","rank":null,"evidence":[],
                  "limitations":["문서의 Java 경험과 공고의 디자인 업무가 달라 관련성이 낮습니다."],"preparationTips":[]}]}
                """;
        var otherJob = new Candidate("MANUAL", 8, "디자인", "디자인 업무", Instant.now(),
                null, false, "READY", null);
        var items = runner.validate(raw, List.of("Java 경험"), List.of(job, otherJob));
        assertThat(items).hasSize(2);
        assertThat(items.get(1).status()).isEqualTo("UNRELATED");
        assertThat(items.get(1).limitations()).containsExactly("문서의 Java 경험과 공고의 디자인 업무가 달라 관련성이 낮습니다.");
        assertThat(runner.validate(raw.replace("\"outcome\":\"UNRELATED\"",
                "\"outcome\":\"INSUFFICIENT_EVIDENCE\""), List.of("Java 경험"), List.of(job, otherJob))
                .get(1).status()).isEqualTo("NO_RESULT");

        var invalid = runner.validate(raw.replace("\"jobQuote\":\"Java 서버\"", "\"jobQuote\":\"없는 공고 문장\""),
                List.of("Java 경험"), List.of(job, otherJob));
        assertThat(invalid).hasSize(2);
        assertThat(invalid.get(0).status()).isEqualTo("UNRELATED");
        assertThat(invalid.get(1).status()).isEqualTo("NO_RESULT");
        assertThat(invalid.get(1).limitations()).isEmpty();
    }

    @Test void clipsLongModelTextAfterCheckingTheFullTextForPersonalData() throws Exception {
        String quote = "Java 서버 ".repeat(21);
        String explanation = "관련 경험을 확인했습니다. ".repeat(25);
        String raw = """
                {"items":[{"kind":"MANUAL","id":7,"rank":1,"evidence":[
                  {"documentQuote":"%s","jobQuote":"%s","explanation":"%s"}],
                  "limitations":["경력 연수는 확인할 수 없음"],"preparationTips":[]}]}
                """.formatted(quote, quote, explanation);
        var longJob = new Candidate("MANUAL", 7, "백엔드", quote, Instant.now(),
                null, false, "READY", null);
        var item = runner.validate(raw, List.of(quote), List.of(longJob)).get(0);
        assertThat(item.evidence().get(0).documentQuote()).hasSize(160);
        assertThat(item.evidence().get(0).jobQuote()).hasSize(160);
        assertThat(item.evidence().get(0).explanation()).hasSize(200);
        assertThatThrownBy(() -> runner.validate(raw.replace(explanation, "010-1234-5678 " + explanation),
                List.of(quote), List.of(longJob))).isInstanceOf(IllegalArgumentException.class)
                .hasMessage("TEXT_PERSONAL_DATA");
    }

    @Test void acceptsOnlyQuotesThatCanBeRecoveredExactlyFromTheSources() throws Exception {
        String raw = """
                {"items":[{"kind":"MANUAL","id":7,"rank":1,"evidence":[
                  {"documentQuote":"\\\"Java 서버 경험\\\"","jobQuote":"Java 서버 운영","explanation":"관련 경험"}],
                  "limitations":["경력 연수는 확인할 수 없음"],
                  "preparationTips":[{"type":"CHECK","basisQuote":"Java 서버 운영","text":"업무를 확인하세요."}]}]}
                """;
        var item = runner.validate(raw, List.of("Java  서버 경험"), List.of(job)).get(0);
        assertThat(item.evidence().get(0).documentQuote()).isEqualTo("Java  서버 경험");
        assertThatThrownBy(() -> runner.validate(raw.replace("Java 서버 경험", "없는 경력"),
                List.of("Java  서버 경험"), List.of(job))).isInstanceOf(IllegalArgumentException.class)
                .hasMessage("DOCUMENT_QUOTE");
    }
    @Test void acceptsHarmlessExtraFieldsAndOmittedOptionalTips() throws Exception {
        String raw = """
                {"items":[{"kind":"MANUAL","id":7,"outcome":"RANKED","rank":1,
                  "evidence":[{"documentQuote":"Java 경험","jobQuote":"Java 서버",
                    "explanation":"관련 경험","confidence":"high"}],
                  "limitations":["운영 규모는 확인할 수 없음"],"summary":"추가 설명"}]}
                """;
        var item = runner.validate(raw, List.of("Java 경험"), List.of(job)).get(0);
        assertThat(item.status()).isEqualTo("COMPLETED");
        assertThat(item.evidence()).hasSize(1);
        assertThat(item.preparationTips()).isEmpty();
        assertThatThrownBy(() -> runner.validate(raw.replace("Java 경험", "없는 경험"),
                List.of("Java 경험"), List.of(job))).isInstanceOf(IllegalArgumentException.class)
                .hasMessage("DOCUMENT_QUOTE");
    }

    @Test void reportsWhyEveryCandidateWasSkipped() {
        assertThatThrownBy(() -> runner.validate(
                """
                {"items":[{"kind":"MANUAL","id":7,"outcome":"UNKNOWN","rank":1}]}
                """, List.of("Java 경험"), List.of(job)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("ITEM_OUTCOME_RANK");
    }
}
