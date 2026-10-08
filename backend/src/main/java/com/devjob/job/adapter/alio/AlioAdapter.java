package com.devjob.job.adapter.alio;

import com.devjob.job.adapter.ExternalJobPosting;
import com.devjob.job.adapter.JobSearchCondition;
import com.devjob.job.adapter.JobSourceAdapter;
import com.devjob.job.adapter.JobSourceDescriptor;
import com.devjob.job.adapter.RecruitmentDetails;
import com.devjob.job.service.ItJobTitles;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/** Public institution recruitment; bounded provider pages and one detail call per selected row. */
@Component
public class AlioAdapter implements JobSourceAdapter {
    static final URI BASE = URI.create("https://opendata.alio.go.kr");
    private final String key;
    private final AlioHttpClient client;
    private final ObjectMapper mapper;
    private final URI base;

    @Autowired
    public AlioAdapter(@Value("${ALIO_SERVICE_KEY:}") String key, AlioHttpClient client, ObjectMapper mapper) {
        this(key, client, mapper, BASE);
    }

    AlioAdapter(String key, AlioHttpClient client, ObjectMapper mapper, URI base) {
        this.key = key == null ? "" : key.strip();
        this.client = client;
        this.mapper = mapper;
        this.base = base;
    }

    @Override public JobSourceDescriptor source() {
        return new JobSourceDescriptor("ALIO_RECRUITMENT", "청년일자리 공공기관 채용");
    }

    public boolean isConfigured() { return !key.isBlank(); }

    @Override public List<ExternalJobPosting> fetchJobs(JobSearchCondition condition) {
        if (condition == null || condition.size() > 20 || condition.page() > 999)
            throw new IllegalArgumentException("Invalid ALIO collection page");
        if (key.isBlank()) throw new AlioSourceException(AlioSourceException.Reason.NOT_CONFIGURED);
        List<ExternalJobPosting> postings = new ArrayList<>();
        for (int offset = 0; offset < condition.pages(); offset++) {
            var fetched = fetchPage(condition, condition.page() + offset, true);
            postings.addAll(fetched.jobs());
            if (fetched.last()) break;
        }
        return List.copyOf(postings);
    }

    /** Batch scope: all ongoing information-communications NCS rows, including non-IT titles. */
    public Page fetchBatchPage(int page) {
        var condition = new JobSearchCondition(null, page, 20);
        if (key.isBlank()) throw new AlioSourceException(AlioSourceException.Reason.NOT_CONFIGURED);
        return fetchPage(condition, page, false);
    }

    public record Page(List<ExternalJobPosting> jobs, boolean last) { }
    private Page fetchPage(JobSearchCondition condition, int page, boolean itTitlesOnly) {
        String query = "serviceKey=" + encode(key) + "&resultType=json&pageNo=" + (page + 1)
                + "&numOfRows=" + condition.size();
        query += "&ncsCdLst=R600020&ongoingYn=Y";
        JsonNode list = response("/new/v1/recruit/list.do?" + query);
        JsonNode rows = list.path("result");
        if (!rows.isArray() || !list.path("totalCount").canConvertToLong()
                || rows.size() > condition.size() || list.path("totalCount").longValue() < rows.size())
            throw new AlioSourceException(AlioSourceException.Reason.INVALID_RESPONSE);
        List<ExternalJobPosting> postings = new ArrayList<>();
        for (JsonNode row : rows) {
            if ((itTitlesOnly && !ItJobTitles.matches(text(row, "recrutPbancTtl")))
                    || !List.of(first(text(row, "ncsCdLst"), "").split(",")).contains("R600020")
                    || (condition.keyword() != null && !first(text(row, "recrutPbancTtl"), "")
                            .toLowerCase(java.util.Locale.ROOT).contains(condition.keyword().toLowerCase(java.util.Locale.ROOT)))) continue;
            Long id = positiveLong(row.path("recrutPblntSn"));
            JsonNode detail = null;
            boolean detailFailed = false;
            if (id != null) {
                try {
                    detail = response("/new/v1/recruit/detail.do?serviceKey=" + encode(key)
                            + "&resultType=json&sn=" + id).path("result");
                    if (!detail.isObject() || !id.equals(positiveLong(detail.path("recrutPblntSn"))))
                        throw new AlioSourceException(AlioSourceException.Reason.INVALID_RESPONSE);
                } catch (AlioSourceException exception) { detailFailed = true; }
            } else { detailFailed = true; }
            JsonNode values = detail == null ? row : detail;
            postings.add(new ExternalJobPosting(id == null ? null : id.toString(), first(text(values, "instNm"), text(row, "instNm")),
                    first(text(values, "recrutPbancTtl"), text(row, "recrutPbancTtl")),
                    detail == null ? null : description(detail), first(text(values, "hireTypeNmLst"), text(row, "hireTypeNmLst")),
                    first(text(values, "recrutSeNm"), text(row, "recrutSeNm")),
                    first(text(values, "workRgnNmLst"), text(row, "workRgnNmLst")),
                    date(first(text(values, "pbancBgngYmd"), text(row, "pbancBgngYmd"))),
                    date(first(text(values, "pbancEndYmd"), text(row, "pbancEndYmd"))),
                    itTitlesOnly ? first(text(values, "srcUrl"), text(row, "srcUrl"))
                            : batchSourceUrl(values, row, id),
                    detail == null ? null : details(detail), detailFailed));
        }
        return new Page(List.copyOf(postings), (long) (page + 1) * condition.size() >= list.path("totalCount").longValue());
    }

    private JsonNode response(String pathAndQuery) {
        try {
            byte[] bytes = client.post(URI.create(base.toString() + pathAndQuery));
            if (bytes == null || bytes.length > 4 * 1024 * 1024
                    || new String(bytes, StandardCharsets.UTF_8).contains(key))
                throw new AlioSourceException(AlioSourceException.Reason.INVALID_RESPONSE);
            JsonNode root = mapper.readTree(bytes);
            if (!root.isObject() || !(root.path("resultCode").canConvertToInt()
                    || root.path("resultCode").isTextual() && root.path("resultCode").asText().matches("\\d{1,3}")))
                throw new AlioSourceException(AlioSourceException.Reason.INVALID_RESPONSE);
            int code = root.path("resultCode").asInt();
            // The live service currently returns 200 for success, while its published code table says 0.
            if (code != 0 && code != 200) throw new AlioSourceException(switch (code) {
                case 5 -> AlioSourceException.Reason.PROVIDER_CONNECTION;
                case 7 -> AlioSourceException.Reason.AUTHENTICATION;
                case 8 -> AlioSourceException.Reason.APPROVAL;
                default -> AlioSourceException.Reason.PROVIDER_ERROR;
            });
            return root;
        } catch (AlioSourceException exception) { throw exception; }
        catch (Exception exception) { throw new AlioSourceException(AlioSourceException.Reason.INVALID_RESPONSE); }
    }

    private RecruitmentDetails details(JsonNode detail) {
        List<RecruitmentDetails.Step> steps = new ArrayList<>();
        JsonNode stepRows = detail.path("steps");
        if (stepRows.isArray()) for (JsonNode step : stepRows) {
            Long id = positiveLong(step.path("recrutStepSn"));
            String title = text(step, "recrutPbancTtl");
            if (id != null && title != null) steps.add(new RecruitmentDetails.Step(id,
                    number(step, "sortNo", 0), title, optionalNumber(step, "recrutNope"),
                    optionalNumber(step, "aplyNope"), text(step, "cmpttRt"), date(text(step, "rsnOcrnYmd"))));
        }
        List<RecruitmentDetails.Attachment> files = new ArrayList<>();
        JsonNode fileRows = detail.path("files");
        if (fileRows.isArray()) for (JsonNode file : fileRows) {
            Long id = positiveLong(file.path("recrutAtchFileNo"));
            String name = text(file, "atchFileNm"), url = attachmentUrl(text(file, "url"));
            if (id != null && name != null && url != null) files.add(new RecruitmentDetails.Attachment(
                    id, number(file, "sortNo", 0), name, text(file, "atchFileType"), url));
        }
        return new RecruitmentDetails(steps, files);
    }

    private String description(JsonNode row) {
        StringBuilder out = new StringBuilder();
        add(out, "지원 자격", text(row, "aplyQlfcCn"));
        add(out, "우대 내용", text(row, "prefCn"));
        add(out, "우대 조건", text(row, "prefCondCn"));
        add(out, "전형 방법", text(row, "scrnprcdrMthdExpln"));
        add(out, "결격 사유", text(row, "disqlfcRsn"));
        return out.isEmpty() ? null : out.toString().strip();
    }

    private static void add(StringBuilder out, String label, String value) {
        if (value != null) out.append(label).append("\n").append(value).append("\n\n");
    }
    private static String text(JsonNode row, String field) {
        JsonNode value = row.path(field);
        if (value.isTextual() && !value.textValue().isBlank()) return value.textValue().strip();
        return value.isNumber() ? value.asText() : null;
    }
    private static String first(String a, String b) { return a == null ? b : a; }

    private static String batchSourceUrl(JsonNode values, JsonNode row, Long id) {
        String detailUrl = text(values, "srcUrl");
        if (validHttpUrl(detailUrl)) return detailUrl;
        String listUrl = text(row, "srcUrl");
        if (validHttpUrl(listUrl)) return listUrl;
        // Verified official public detail page uses the same recruitment announcement number.
        return id == null ? first(detailUrl, listUrl)
                : BASE + "/new/odaApiMng/recrutInquiryDetail.do?sn=" + id;
    }

    private static boolean validHttpUrl(String value) {
        if (value == null) return false;
        try {
            URI uri = URI.create(value);
            return ("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))
                    && uri.getHost() != null && uri.getUserInfo() == null;
        } catch (IllegalArgumentException exception) {
            return false;
        }
    }
    private static String date(String value) {
        if (value != null && value.matches("\\d{8}"))
            return value.substring(0, 4) + "-" + value.substring(4, 6) + "-" + value.substring(6);
        return value;
    }
    private static Long positiveLong(JsonNode value) {
        return value.canConvertToLong() && value.longValue() > 0 ? value.longValue() : null;
    }
    private static Integer optionalNumber(JsonNode row, String field) {
        JsonNode value = row.path(field);
        return value.canConvertToInt() && value.intValue() >= 0 ? value.intValue() : null;
    }
    private static int number(JsonNode row, String field, int fallback) {
        Integer value = optionalNumber(row, field);
        return value == null ? fallback : value;
    }
    private String attachmentUrl(String url) {
        try {
            URI uri = URI.create(url);
            if (!uri.isAbsolute() && url.startsWith("/") && !url.startsWith("//")) uri = base.resolve(uri);
            return ("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                    && uri.getHost() != null && uri.getUserInfo() == null ? uri.toString() : null;
        } catch (Exception exception) { return null; }
    }
    private static String encode(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }
}
