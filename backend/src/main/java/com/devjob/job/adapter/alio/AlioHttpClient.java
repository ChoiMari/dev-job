package com.devjob.job.adapter.alio;

import java.io.ByteArrayOutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import org.springframework.stereotype.Component;

/** Bounded POST transport; no redirects, retries or URL logging. */
@Component
public class AlioHttpClient {
    private static final int LIMIT = 4 * 1024 * 1024;

    public byte[] post(URI uri) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) uri.toURL().openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(3000);
            connection.setReadTimeout(10000);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("Accept", "application/json");
            connection.setDoOutput(true);
            connection.setFixedLengthStreamingMode(0);
            connection.connect();
            try (var output = connection.getOutputStream()) { output.flush(); }
            if (connection.getResponseCode() != 200 || connection.getContentLengthLong() > LIMIT) {
                throw new AlioSourceException(AlioSourceException.Reason.REQUEST_FAILED);
            }
            try (var stream = connection.getInputStream(); var body = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192];
                int count;
                long deadline = System.nanoTime() + 10_000_000_000L;
                while ((count = stream.read(buffer)) != -1) {
                    if (System.nanoTime() >= deadline || body.size() + count > LIMIT)
                        throw new AlioSourceException(AlioSourceException.Reason.REQUEST_FAILED);
                    body.write(buffer, 0, count);
                }
                return body.toByteArray();
            }
        } catch (Exception exception) {
            throw new AlioSourceException(AlioSourceException.Reason.REQUEST_FAILED);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }
}
