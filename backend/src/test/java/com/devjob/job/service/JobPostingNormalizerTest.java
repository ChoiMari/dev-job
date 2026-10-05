package com.devjob.job.service;

import com.devjob.job.adapter.ExternalJobPosting;
import com.devjob.job.adapter.JobSearchCondition;
import com.devjob.job.adapter.JobSourceDescriptor;
import java.time.LocalDate;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import static org.assertj.core.api.Assertions.*;

class JobPostingNormalizerTest {
    private final JobPostingNormalizer normalizer = new JobPostingNormalizer();

    @Test
    void trimsFieldsAndPreservesOriginalBodyLineBreaksAndIdentifierCase() {
        var result = normalizer.normalize(new ExternalJobPosting(" AbC ", " 회사 ", " 제목 ",
                " Java\nSQL ", " 정규직 ", " 신입 ", " 서울 ",
                " 2026-10-01 ", "2026-10-01", " https://example.com/jobs/AbC "));
        assertThat(result.externalId()).isEqualTo("AbC");
        assertThat(result.companyName()).isEqualTo("회사");
        assertThat(result.title()).isEqualTo("제목");
        assertThat(result.description()).isEqualTo("Java\nSQL");
        assertThat(result.employmentType()).isEqualTo("정규직");
        assertThat(result.careerRequirement()).isEqualTo("신입");
        assertThat(result.location()).isEqualTo("서울");
        assertThat(result.postedDate()).isEqualTo(LocalDate.of(2026, 10, 1));
        assertThat(result.deadlineDate()).isEqualTo(result.postedDate());
        assertThat(result.sourceUrl()).isEqualTo("https://example.com/jobs/AbC");
    }

    @Test
    void missingOptionalFieldsBecomeNullWithoutInventedValues() {
        var result = normalizer.normalize(new ExternalJobPosting("id", "회사", "제목",
                " ", null, "", "\t", " ", null, "https://example.com/jobs/1"));
        assertThat(result.description()).isNull();
        assertThat(result.employmentType()).isNull();
        assertThat(result.careerRequirement()).isNull();
        assertThat(result.location()).isNull();
        assertThat(result.postedDate()).isNull();
        assertThat(result.deadlineDate()).isNull();
    }

    @ParameterizedTest
    @MethodSource("missingRequiredFields")
    void missingRequiredFieldsAreRejected(ExternalJobPosting input) {
        assertThatIllegalArgumentException().isThrownBy(() -> normalizer.normalize(input));
    }

    static Stream<ExternalJobPosting> missingRequiredFields() {
        return Stream.of(null,
                posting(null, "회사", "제목", "https://example.com"),
                posting(" ", "회사", "제목", "https://example.com"),
                posting("id", null, "제목", "https://example.com"),
                posting("id", " ", "제목", "https://example.com"),
                posting("id", "회사", null, "https://example.com"),
                posting("id", "회사", " ", "https://example.com"),
                posting("id", "회사", "제목", null),
                posting("id", "회사", "제목", " "));
    }

    private static ExternalJobPosting posting(String id, String company, String title, String url) {
        return new ExternalJobPosting(id, company, title, null, null, null, null, null, null, url);
    }

    @ParameterizedTest
    @ValueSource(strings = {"javascript:alert(1)", "/relative", "https://", "https://user:secret@example.com",
            "https://example.com/invalid space", "ftp://example.com"})
    void malformedOrNonHttpUrlsAreRejected(String url) {
        assertThatIllegalArgumentException().isThrownBy(() ->
                normalizer.normalize(posting("id", "회사", "제목", url)));
    }

    @ParameterizedTest
    @ValueSource(strings = {"2026-02-30", "2026/10/01", "yesterday"})
    void invalidDatesAreRejected(String date) {
        assertThatExceptionOfType(java.time.DateTimeException.class).isThrownBy(() ->
                normalizer.normalize(new ExternalJobPosting("id", "회사", "제목",
                        null, null, null, null, date, null, "https://example.com")));
    }

    @Test
    void deadlineCannotPrecedePostingDateButMayExistWithoutPostingDate() {
        assertThatIllegalArgumentException().isThrownBy(() -> normalizer.normalize(
                new ExternalJobPosting("id", "회사", "제목", null, null, null, null,
                        "2026-10-05", "2026-10-04", "https://example.com")));
        assertThat(normalizer.normalize(new ExternalJobPosting("id", "회사", "제목",
                null, null, null, null, null, "2026-10-04", "https://example.com")).deadlineDate())
                .isEqualTo(LocalDate.of(2026, 10, 4));
    }

    @Test
    void sourceAndInternalConditionsAreValidated() {
        assertThat(new JobSourceDescriptor(" mock ", " 모의 ").code()).isEqualTo("MOCK");
        assertThatIllegalArgumentException().isThrownBy(() -> new JobSourceDescriptor("", "source"));
        assertThatIllegalArgumentException().isThrownBy(() -> new JobSourceDescriptor("mock", " "));
        assertThatIllegalArgumentException().isThrownBy(() -> new JobSearchCondition(null, -1, 20));
        assertThatIllegalArgumentException().isThrownBy(() -> new JobSearchCondition(null, 0, 0));
        assertThatIllegalArgumentException().isThrownBy(() -> new JobSearchCondition(null, 0, 101));
        assertThat(new JobSearchCondition(" Java ", 0, 20).keyword()).isEqualTo("Java");
    }
}
