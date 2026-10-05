package com.devjob.job.adapter.work24;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URI;
import org.springframework.stereotype.Component;
import static com.devjob.job.adapter.work24.Work24SourceException.Reason.REQUEST_FAILED;

/** JDK transport: bounded reads, no redirects, no retry, no request/response logging. */
@Component
public class Work24HttpClient {
    private final int connectTimeoutMillis;
    private final int readTimeoutMillis;
    private final int maxResponseBytes;

    public Work24HttpClient() { this(3000, 10000, 2 * 1024 * 1024); }

    Work24HttpClient(int connectTimeoutMillis, int readTimeoutMillis, int maxResponseBytes) {
        this.connectTimeoutMillis = connectTimeoutMillis;
        this.readTimeoutMillis = readTimeoutMillis;
        this.maxResponseBytes = maxResponseBytes;
    }

    public byte[] get(URI uri) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) uri.toURL().openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(connectTimeoutMillis);
            connection.setReadTimeout(readTimeoutMillis);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("Accept", "application/xml");
            if (connection.getResponseCode() != 200) {
                throw new Work24SourceException(REQUEST_FAILED);
            }
            if (connection.getContentLengthLong() > maxResponseBytes) {
                throw new Work24SourceException(REQUEST_FAILED);
            }
            try (var stream = connection.getInputStream()) {
                long deadline = System.nanoTime() + readTimeoutMillis * 1_000_000L;
                var body = new ByteArrayOutputStream();
                byte[] buffer = new byte[8192];
                while (true) {
                    if (System.nanoTime() >= deadline) { throw new Work24SourceException(REQUEST_FAILED); }
                    int count = stream.read(buffer);
                    if (System.nanoTime() >= deadline) { throw new Work24SourceException(REQUEST_FAILED); }
                    if (count == -1) { return body.toByteArray(); }
                    if (body.size() + count > maxResponseBytes) {
                        throw new Work24SourceException(REQUEST_FAILED);
                    }
                    body.write(buffer, 0, count);
                }
            }
        } catch (IOException | RuntimeException exception) {
            // Even an IOException can contain the authentication query; never retain its cause.
            throw new Work24SourceException(REQUEST_FAILED);
        } finally {
            if (connection != null) { connection.disconnect(); }
        }
    }
}
