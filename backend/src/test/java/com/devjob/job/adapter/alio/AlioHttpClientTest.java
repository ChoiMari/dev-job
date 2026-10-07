package com.devjob.job.adapter.alio;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class AlioHttpClientTest {
    @Test
    void postsOnceWithoutFollowingRedirectsOrExposingSecret() throws Exception {
        var server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        var calls = new AtomicInteger();
        server.createContext("/list", exchange -> {
            calls.incrementAndGet();
            assertThat(exchange.getRequestMethod()).isEqualTo("POST");
            byte[] body = "{\"resultCode\":0}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            try (exchange) { exchange.getResponseBody().write(body); }
        });
        server.createContext("/redirect", exchange -> {
            calls.incrementAndGet();
            exchange.getResponseHeaders().add("Location", "/list");
            exchange.sendResponseHeaders(302, -1);
            exchange.close();
        });
        server.start();
        try {
            String base = "http://127.0.0.1:" + server.getAddress().getPort();
            assertThat(new String(new AlioHttpClient().post(URI.create(base + "/list?serviceKey=fixture-secret")),
                    StandardCharsets.UTF_8)).contains("resultCode");
            assertThatThrownBy(() -> new AlioHttpClient().post(URI.create(base + "/redirect?serviceKey=fixture-secret")))
                    .isInstanceOf(AlioSourceException.class).hasMessageNotContaining("fixture-secret");
            assertThat(calls).hasValue(2);
        } finally { server.stop(0); }
    }
}
