package com.devjob.job.adapter.work24;

import com.devjob.job.adapter.ExternalJobPosting;
import com.devjob.job.adapter.JobSearchCondition;
import com.devjob.job.adapter.JobSourceAdapter;
import com.devjob.job.adapter.JobSourceDescriptor;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.w3c.dom.Element;
import org.xml.sax.ErrorHandler;
import org.xml.sax.SAXParseException;
import static com.devjob.job.adapter.work24.Work24SourceException.Reason.*;

/** Personal-account-compatible open recruitment list; never uses the restricted general job API. */
@Component
public class Work24Adapter implements JobSourceAdapter {
    static final URI ENDPOINT = URI.create(
            "https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L21.do");
    private final String authKey;
    private final Work24HttpClient client;
    private final URI endpoint;

    @Autowired
    public Work24Adapter(@Value("${WORK24_AUTH_KEY:}") String authKey, Work24HttpClient client) {
        this(authKey, client, ENDPOINT);
    }

    // Package-private endpoint injection is only used by loopback HTTP tests.
    Work24Adapter(String authKey, Work24HttpClient client, URI endpoint) {
        this.authKey = authKey == null ? "" : authKey.strip();
        this.client = client;
        this.endpoint = endpoint;
    }

    @Override
    public JobSourceDescriptor source() {
        return new JobSourceDescriptor("WORK24_OPEN_RECRUITMENT", "고용24 공채속보");
    }

    @Override
    public List<ExternalJobPosting> fetchJobs(JobSearchCondition condition) {
        if (condition == null || condition.page() > 999) {
            throw new IllegalArgumentException("Invalid Work24 collection page");
        }
        if (authKey.isBlank()) { throw new Work24SourceException(NOT_CONFIGURED); }
        String query = "?authKey=" + encode(authKey) + "&callTp=L&returnType=XML&startPage="
                + (condition.page() + 1) + "&display=" + condition.size();
        if (condition.keyword() != null) {
            query += "&empWantedTitle=" + encode(condition.keyword());
        }
        byte[] response;
        try {
            response = client.get(URI.create(endpoint.toString() + query));
        } catch (RuntimeException exception) {
            throw new Work24SourceException(REQUEST_FAILED);
        }
        return parse(response, condition);
    }

    private List<ExternalJobPosting> parse(byte[] response, JobSearchCondition condition) {
        try {
            if (response == null || response.length > 2 * 1024 * 1024
                    || new String(response, StandardCharsets.UTF_8).contains(authKey)) {
                throw new Work24SourceException(INVALID_RESPONSE);
            }
            var factory = DocumentBuilderFactory.newInstance();
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            var builder = factory.newDocumentBuilder();
            builder.setErrorHandler(new ErrorHandler() {
                public void warning(SAXParseException exception) throws SAXParseException { throw exception; }
                public void error(SAXParseException exception) throws SAXParseException { throw exception; }
                public void fatalError(SAXParseException exception) throws SAXParseException { throw exception; }
            });
            Element root = builder.parse(new ByteArrayInputStream(response)).getDocumentElement();
            if (!root.getTagName().equals("dhsOpenEmpInfoList")
                    || root.getElementsByTagName("error").getLength() != 0 || root.getTextContent().contains(authKey)) {
                throw new Work24SourceException(INVALID_RESPONSE);
            }
            String totalText = value(root, "total");
            if (totalText == null || !totalText.matches("[0-9]+")) {
                throw new Work24SourceException(INVALID_RESPONSE);
            }
            long total = Long.parseLong(totalText);
            List<ExternalJobPosting> postings = new ArrayList<>();
            for (var node = root.getFirstChild(); node != null; node = node.getNextSibling()) {
                if (node instanceof Element row && row.getTagName().equals("dhsOpenEmpInfo")) {
                    postings.add(new ExternalJobPosting(value(row, "empSeqno"), value(row, "empBusiNm"),
                            value(row, "empWantedTitle"), null, value(row, "empWantedTypeNm"),
                            null, null, null, null, value(row, "empWantedHomepgDetail")));
                }
            }
            if (postings.size() > condition.size() || postings.size() > total
                    || (postings.isEmpty() && (long) condition.page() * condition.size() < total)
                    || root.getElementsByTagName("dhsOpenEmpInfo").getLength() != postings.size()) {
                throw new Work24SourceException(INVALID_RESPONSE);
            }
            return List.copyOf(postings);
        } catch (Exception exception) {
            // XML parsers may include response text in diagnostics; expose a fixed reason only.
            throw new Work24SourceException(INVALID_RESPONSE);
        }
    }

    private static String value(Element parent, String name) {
        String result = null;
        for (var node = parent.getFirstChild(); node != null; node = node.getNextSibling()) {
            if (node instanceof Element child && child.getTagName().equals(name)) {
                if (result != null || child.getElementsByTagName("*").getLength() != 0) {
                    throw new Work24SourceException(INVALID_RESPONSE);
                }
                result = child.getTextContent().strip();
            }
        }
        return result == null || result.isBlank() ? null : result;
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
