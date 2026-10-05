package com.devjob.job.adapter.work24;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class Work24HttpClientTest {
    private HttpServer server;
    private URI endpoint;
    private final AtomicInteger calls = new AtomicInteger();

    @BeforeEach
    void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        endpoint = URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/list?authKey=test-secret");
    }

    @AfterEach
    void stop() { server.stop(0); }

    @Test
    void readsUtf8ResponseWithOneGet() {
        server.createContext("/list", exchange -> {
            calls.incrementAndGet();
            assertThat(exchange.getRequestMethod()).isEqualTo("GET");
            assertThat(exchange.getRequestHeaders().getFirst("Accept")).isEqualTo("application/xml");
            byte[] body = "공채속보".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(200, body.length);
            try (exchange) { exchange.getResponseBody().write(body); }
        });
        server.start();
        assertThat(new String(new Work24HttpClient().get(endpoint), StandardCharsets.UTF_8)).isEqualTo("공채속보");
        assertThat(calls).hasValue(1);
    }

    @Test
    void nonSuccessAndRedirectDoNotRetryOrForwardCredentials() {
        server.createContext("/list", exchange -> {
            calls.incrementAndGet();
            exchange.getResponseHeaders().set("Location", endpoint.resolve("/unexpected").toString());
            exchange.sendResponseHeaders(302, -1);
            exchange.close();
        });
        server.createContext("/unexpected", exchange -> {
            calls.addAndGet(100);
            exchange.close();
        });
        server.start();
        assertSafeFailure(new Work24HttpClient());
        assertThat(calls).hasValue(1);
    }

    @Test
    void rejectsHttpFailureWithoutReadingOrReportingPrivateBody() {
        server.createContext("/list", exchange -> {
            calls.incrementAndGet();
            byte[] body = "private test-secret".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(503, body.length);
            try (exchange) { exchange.getResponseBody().write(body); }
        });
        server.start();
        assertSafeFailure(new Work24HttpClient());
        assertThat(calls).hasValue(1);
    }

    @Test
    void capsChunkedResponseWithoutContentLength() {
        server.createContext("/list", exchange -> {
            exchange.sendResponseHeaders(200, 0);
            try (exchange) { exchange.getResponseBody().write(new byte[65]); }
        });
        server.start();
        assertSafeFailure(new Work24HttpClient(1000, 1000, 64));
    }

    @Test
    void capsDeclaredResponseLength() {
        server.createContext("/list", exchange -> {
            exchange.sendResponseHeaders(200, 65);
            try (exchange) { exchange.getResponseBody().write(new byte[65]); }
        });
        server.start();
        assertSafeFailure(new Work24HttpClient(1000, 1000, 64));
    }

    @Test
    void slowBodyTimesOutAndDoesNotRetry() {
        server.createContext("/list", exchange -> {
            calls.incrementAndGet();
            exchange.sendResponseHeaders(200, 1);
            try (exchange) {
                try { Thread.sleep(750); } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                }
                try { exchange.getResponseBody().write(1); } catch (java.io.IOException ignored) { }
            }
        });
        server.start();
        assertSafeFailure(new Work24HttpClient(1000, 100, 64));
        assertThat(calls).hasValue(1);
    }


    @Test
    void tricklingBodyCannotKeepTheCallOpenIndefinitely() {
        server.createContext("/list", exchange -> {
            calls.incrementAndGet();
            exchange.sendResponseHeaders(200, 6);
            try (exchange) {
                for (int index = 0; index < 6; index++) {
                    try { Thread.sleep(100); } catch (InterruptedException exception) {
                        Thread.currentThread().interrupt();
                        return;
                    }
                    try {
                        exchange.getResponseBody().write(1);
                        exchange.getResponseBody().flush();
                    } catch (java.io.IOException ignored) { return; }
                }
            }
        });
        server.start();
        assertSafeFailure(new Work24HttpClient(1000, 250, 64));
        assertThat(calls).hasValue(1);
    }

    private void assertSafeFailure(Work24HttpClient client) {
        assertThatThrownBy(() -> client.get(endpoint)).isInstanceOf(Work24SourceException.class)
                .hasNoCause().hasMessageNotContaining("test-secret")
                .hasMessageNotContaining("127.0.0.1");
    }
}
