package com.devjob.job.adapter.alio;

import com.devjob.job.adapter.JobSearchCondition;
import com.devjob.job.service.JobPostingNormalizer;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class AlioAdapterTest {
    private final AlioHttpClient client = mock(AlioHttpClient.class);
    private final AlioAdapter adapter = new AlioAdapter("fixture-key", client, new ObjectMapper());

    @Test
    void mapsOneListRowAndOfficialDetailIntoExistingPostingAndMetadata() {
        when(client.post(any())).thenAnswer(invocation -> {
            URI uri = invocation.getArgument(0);
            return bytes(uri.getPath().endsWith("list.do") ? list() : detail());
        });
        var rows = adapter.fetchJobs(new JobSearchCondition("개발", 0, 1));
        assertThat(rows).hasSize(1);
        var posting = new JobPostingNormalizer().normalize(rows.get(0));
        assertThat(posting.externalId()).isEqualTo("123");
        assertThat(posting.companyName()).isEqualTo("공공기관");
        assertThat(posting.careerRequirement()).isEqualTo("신입");
        assertThat(posting.employmentType()).isEqualTo("정규직");
        assertThat(posting.location()).isEqualTo("서울");
        assertThat(posting.postedDate()).hasToString("2026-10-01");
        assertThat(posting.deadlineDate()).hasToString("2026-10-20");
        assertThat(posting.description()).contains("지원 자격", "Java", "전형 방법", "서류 전형");
        assertThat(rows.get(0).details().steps()).hasSize(1);
        assertThat(rows.get(0).details().attachments()).hasSize(1);
        assertThat(rows.get(0).details().attachments().get(0).url())
                .isEqualTo("https://opendata.alio.go.kr/recruit/file.pdf");
        assertThat(rows.get(0).detailFailed()).isFalse();
        var uris = ArgumentCaptor.forClass(URI.class);
        verify(client, times(2)).post(uris.capture());
        assertThat(uris.getAllValues().get(0).getPath()).isEqualTo("/new/v1/recruit/list.do");
        assertThat(uris.getAllValues().get(0).getRawQuery()).contains("pageNo=1", "numOfRows=1", "ncsCdLst=R600020", "ongoingYn=Y")
                .doesNotContain("recrutPbancTtl");
        assertThat(uris.getAllValues().get(1).getRawQuery()).contains("sn=123");
    }

    @Test
    void failedDetailKeepsListFieldsAndReportsPartialFailureMarker() {
        when(client.post(any())).thenAnswer(invocation -> bytes(
                ((URI) invocation.getArgument(0)).getPath().endsWith("list.do") ? list() : "{\"resultCode\":5}"));
        var row = adapter.fetchJobs(new JobSearchCondition(null, 0, 1)).get(0);
        assertThat(row.detailFailed()).isTrue();
        assertThat(row.details()).isNull();
        assertThat(new JobPostingNormalizer().normalize(row).title()).isEqualTo("개발자 채용");
    }

    @Test
    void authenticationOrMalformedListNeverProducesSavedPostings() {
        when(client.post(any())).thenReturn(bytes("{\"resultCode\":8}"));
        assertThatThrownBy(() -> adapter.fetchJobs(new JobSearchCondition(null, 0, 1)))
                .isInstanceOf(AlioSourceException.class)
                .hasMessageContaining("APPROVAL");
        reset(client);
        when(client.post(any())).thenReturn(bytes("{\"resultCode\":\"5\",\"resultMsg\":\"service unavailable\"}"));
        assertThatThrownBy(() -> adapter.fetchJobs(new JobSearchCondition(null, 0, 1)))
                .isInstanceOf(AlioSourceException.class)
                .hasMessageContaining("PROVIDER_CONNECTION");
        reset(client);
        when(client.post(any())).thenReturn(bytes("{\"resultCode\":0,\"result\":{},\"totalCount\":1}"));
        assertThatThrownBy(() -> adapter.fetchJobs(new JobSearchCondition(null, 0, 1)))
                .isInstanceOf(AlioSourceException.class);
        assertThatThrownBy(() -> adapter.fetchJobs(new JobSearchCondition(null, 0, 21)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void emptyListIsValid() {
        when(client.post(any())).thenReturn(bytes("{\"resultCode\":0,\"result\":[],\"totalCount\":0}"));
        assertThat(adapter.fetchJobs(new JobSearchCondition(null, 0, 1))).isEmpty();
        verify(client).post(any());
    }

    @Test
    void skipsNonSoftwareTitlesBeforeCallingDetail() {
        when(client.post(any())).thenReturn(bytes(list().replace("개발자 채용", "전력통신 공사 채용")));
        assertThat(adapter.fetchJobs(new JobSearchCondition(null, 0, 1))).isEmpty();
        verify(client, times(1)).post(any());
    }

    @Test
    void filtersKoreanKeywordWithinOneProviderPage() {
        when(client.post(any())).thenReturn(bytes(list()));
        assertThat(adapter.fetchJobs(new JobSearchCondition("보안", 0, 1))).isEmpty();
        verify(client, times(1)).post(any());
    }

    @Test
    void batchUsesVerifiedOfficialDetailLinkWhenProvidedUrlIsInvalid() {
        when(client.post(any())).thenAnswer(invocation -> bytes(
                ((URI) invocation.getArgument(0)).getPath().endsWith("list.do")
                        ? list().replace("https://example.com/recruit/123", "해당없음")
                        : detail().replace("https://example.com/recruit/123", "해당없음")));
        var batchRow = adapter.fetchBatchPage(0).jobs().get(0);
        assertThat(batchRow.sourceUrl()).isEqualTo(
                "https://opendata.alio.go.kr/new/odaApiMng/recrutInquiryDetail.do?sn=123");
        assertThat(new JobPostingNormalizer().normalize(batchRow).externalId()).isEqualTo("123");
        var oldManualRow = adapter.fetchJobs(new JobSearchCondition(null, 0, 1)).get(0);
        assertThat(oldManualRow.sourceUrl()).isEqualTo("해당없음");
    }

    private static byte[] bytes(String value) { return value.getBytes(StandardCharsets.UTF_8); }
    private static String list() { return """
            {"resultCode":200,"totalCount":1,"result":[{"recrutPblntSn":123,
            "instNm":"공공기관","recrutPbancTtl":"개발자 채용","ncsCdLst":"R600020","srcUrl":"https://example.com/recruit/123",
            "hireTypeNmLst":"정규직","recrutSeNm":"신입","workRgnNmLst":"서울",
            "pbancBgngYmd":"20261001","pbancEndYmd":"20261020"}]}
            """; }
    private static String detail() { return """
            {"resultCode":200,"result":{"recrutPblntSn":123,"instNm":"공공기관",
            "recrutPbancTtl":"개발자 채용","srcUrl":"https://example.com/recruit/123",
            "aplyQlfcCn":"Java","scrnprcdrMthdExpln":"서류 전형",
            "steps":[{"recrutStepSn":1,"sortNo":1,"recrutPbancTtl":"서류 전형","recrutNope":2}],
            "files":[{"recrutAtchFileNo":10,"sortNo":1,"atchFileNm":"공고.pdf",
            "atchFileType":"A","url":"/recruit/file.pdf"}]}}
            """; }
}
