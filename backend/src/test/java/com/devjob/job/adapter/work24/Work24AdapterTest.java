package com.devjob.job.adapter.work24;

import com.devjob.job.adapter.JobSearchCondition;
import com.devjob.job.service.JobCollectionService;
import com.devjob.job.service.JobPostingNormalizer;
import com.devjob.job.service.JobPostingWriter;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import static com.devjob.job.adapter.work24.Work24SourceException.Reason.*;
import static com.devjob.job.service.JobCollectionResult.Status.SOURCE_FAILED;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(OutputCaptureExtension.class)
class Work24AdapterTest {
    private static final String KEY = "test-only-auth-secret";
    private final Work24HttpClient client = mock(Work24HttpClient.class);
    private final Work24Adapter adapter = new Work24Adapter(KEY, client);

    @Test
    void mapsOfficialListFieldsAndProviderKeywordWithOneRequest() throws Exception {
        when(client.get(any())).thenReturn(fixture());
        var rows = adapter.fetchJobs(new JobSearchCondition(" Java & 한글 ", 999, 100));
        var uri = ArgumentCaptor.forClass(URI.class);
        verify(client, times(1)).get(uri.capture());
        assertThat(uri.getValue().getHost()).isEqualTo("www.work24.go.kr");
        assertThat(uri.getValue().getPath()).endsWith("callOpenApiSvcInfo210L21.do");
        assertThat(URLDecoder.decode(uri.getValue().getRawQuery(), StandardCharsets.UTF_8))
                .contains("authKey=" + KEY, "callTp=L", "returnType=XML", "startPage=1000",
                        "display=100", "empWantedTitle=Java & 한글");
        assertThat(uri.getValue().getRawQuery()).contains("%26", "%ED%95%9C");
        assertThat(adapter.source().code()).isEqualTo("WORK24_OPEN_RECRUITMENT");
        var first = new JobPostingNormalizer().normalize(rows.get(0));
        assertThat(first.externalId()).isEqualTo("Open-AbC-1");
        assertThat(first.companyName()).isEqualTo("모의 기업");
        assertThat(first.title()).isEqualTo("백엔드 개발자 공채");
        assertThat(first.employmentType()).isEqualTo("정규직");
        assertThat(first.sourceUrl()).isEqualTo("https://example.com/recruit/Open-AbC-1");
        assertThat(first.description()).isNull();
        assertThat(first.location()).isNull();
        assertThat(first.careerRequirement()).isNull();
        assertThat(first.postedDate()).isNull();
        assertThat(first.deadlineDate()).isNull();
        assertThat(rows).hasSize(3);
        assertThatIllegalArgumentException().isThrownBy(() -> new JobPostingNormalizer().normalize(rows.get(2)));
    }

    @Test
    void rejectsUnsupportedPageBeforeCallingProvider() {
        assertThatIllegalArgumentException()
                .isThrownBy(() -> adapter.fetchJobs(new JobSearchCondition(null, 1000, 1)));
        verifyNoInteractions(client);
    }

    @Test
    void missingKeyFailsOnlyWhenCollectionIsRequested(CapturedOutput output) {
        var unconfigured = new Work24Adapter(" ", client);
        var writer = mock(JobPostingWriter.class);
        var service = new JobCollectionService(new JobPostingNormalizer(), writer);
        assertThat(service.collect(unconfigured, new JobSearchCondition(null, 0, 1)).status())
                .isEqualTo(SOURCE_FAILED);
        verifyNoInteractions(client, writer);
        assertThatThrownBy(() -> unconfigured.fetchJobs(new JobSearchCondition(null, 0, 1)))
                .isInstanceOf(Work24SourceException.class).hasMessageContaining(NOT_CONFIGURED.name())
                .hasNoCause();
        assertThat(output).doesNotContain(KEY);
    }

    @Test
    void providerExceptionAndCredentialsNeverEscapeOrReachLogs(CapturedOutput output) {
        when(client.get(any())).thenThrow(new IllegalStateException("https://provider?authKey=" + KEY));
        assertThatThrownBy(() -> adapter.fetchJobs(new JobSearchCondition(null, 0, 1)))
                .isInstanceOf(Work24SourceException.class).hasMessageContaining(REQUEST_FAILED.name())
                .hasNoCause().hasMessageNotContaining(KEY);
        var writer = mock(JobPostingWriter.class);
        var service = new JobCollectionService(new JobPostingNormalizer(), writer);
        assertThat(service.collect(adapter, new JobSearchCondition(null, 0, 1)).status()).isEqualTo(SOURCE_FAILED);
        verifyNoInteractions(writer);
        assertThat(output).doesNotContain(KEY, "https://provider");
    }

    @ParameterizedTest
    @MethodSource("invalidResponses")
    void malformedOrErrorEnvelopeIsNeverAnEmptySuccess(String xml, CapturedOutput output) {
        when(client.get(any())).thenReturn(xml.getBytes(StandardCharsets.UTF_8));
        assertThatThrownBy(() -> adapter.fetchJobs(new JobSearchCondition(null, 0, 20)))
                .isInstanceOf(Work24SourceException.class).hasNoCause()
                .hasMessageContaining(INVALID_RESPONSE.name()).hasMessageNotContaining(KEY);
        assertThat(output).doesNotContain(KEY, "Fatal Error", "DOCTYPE");
    }

    static Stream<String> invalidResponses() {
        return Stream.of("", "<html>failure</html>", "<GO24><error>not permitted</error></GO24>",
                "<dhsOpenEmpInfoList><error>quota</error><total>0</total></dhsOpenEmpInfoList>",
                "<dhsOpenEmpInfoList/>", "<dhsOpenEmpInfoList><total>-1</total></dhsOpenEmpInfoList>",
                "<dhsOpenEmpInfoList><total>1</total></dhsOpenEmpInfoList>",
                "<dhsOpenEmpInfoList><total>0</total><note>&#116;est-only-auth-secret</note></dhsOpenEmpInfoList>",
                "<dhsOpenEmpInfoList><total>0</total><total>1</total></dhsOpenEmpInfoList>",
                "<dhsOpenEmpInfoList><total>0</total><dhsOpenEmpInfo/></dhsOpenEmpInfoList>",
                "<dhsOpenEmpInfoList><total>1</total><wrap><dhsOpenEmpInfo/></wrap></dhsOpenEmpInfoList>",
                "<dhsOpenEmpInfoList><total>1</total><dhsOpenEmpInfo><empSeqno><nested>id</nested>"
                        + "</empSeqno></dhsOpenEmpInfo></dhsOpenEmpInfoList>",
                "<dhsOpenEmpInfoList><total>1</total><dhsOpenEmpInfo><empSeqno>x</empSeqno>"
                        + "<empSeqno>y</empSeqno></dhsOpenEmpInfo></dhsOpenEmpInfoList>",
                "<!DOCTYPE dhsOpenEmpInfoList [<!ENTITY xxe SYSTEM 'file:///private'>]>"
                        + "<dhsOpenEmpInfoList><total>&xxe;</total></dhsOpenEmpInfoList>",
                "<dhsOpenEmpInfoList><total>0</total><note>" + KEY + "</note></dhsOpenEmpInfoList>");
    }

    @Test
    void acceptsEmptyPagesAndDoesNotInventMissingOrUnconfirmedValues() {
        when(client.get(any())).thenReturn(("""
                <dhsOpenEmpInfoList><total>0</total></dhsOpenEmpInfoList>
                """).getBytes(StandardCharsets.UTF_8));
        assertThat(adapter.fetchJobs(new JobSearchCondition(null, 0, 1))).isEmpty();
        when(client.get(any())).thenReturn(
                "<dhsOpenEmpInfoList><total>1</total></dhsOpenEmpInfoList>".getBytes(StandardCharsets.UTF_8));
        assertThat(adapter.fetchJobs(new JobSearchCondition(null, 1, 1))).isEmpty();
        when(client.get(any())).thenReturn(("""
                <dhsOpenEmpInfoList><total>1</total><dhsOpenEmpInfo>
                <empSeqno>x</empSeqno><empBusiNm>회사</empBusiNm><empWantedTitle>제목</empWantedTitle>
                <empWantedStdt>unconfirmed-format</empWantedStdt><empWantedEndt>unknown</empWantedEndt>
                <empWantedMobileUrl>https://example.com/mobile</empWantedMobileUrl>
                </dhsOpenEmpInfo></dhsOpenEmpInfoList>
                """).getBytes(StandardCharsets.UTF_8));
        var row = adapter.fetchJobs(new JobSearchCondition(null, 0, 1)).get(0);
        assertThat(row.sourceUrl()).isNull();
        assertThat(row.postedDate()).isNull();
        assertThat(row.deadlineDate()).isNull();
        assertThat(row.employmentType()).isNull();
    }

    @Test
    void rejectsOversizedPageOrResponse() throws Exception {
        when(client.get(any())).thenReturn(fixture());
        assertThatThrownBy(() -> adapter.fetchJobs(new JobSearchCondition(null, 0, 1)))
                .isInstanceOf(Work24SourceException.class);
        when(client.get(any())).thenReturn(new byte[2 * 1024 * 1024 + 1]);
        assertThatThrownBy(() -> adapter.fetchJobs(new JobSearchCondition(null, 0, 20)))
                .isInstanceOf(Work24SourceException.class);
    }

    static byte[] fixture() throws Exception {
        try (var stream = Work24AdapterTest.class.getResourceAsStream("/fixtures/work24-open-recruitment.xml")) {
            return stream.readAllBytes();
        }
    }
}
