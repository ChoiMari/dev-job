package com.devjob.auth;

import com.devjob.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.UUID;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import static org.assertj.core.api.Assertions.*;

@Tag("database")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AuthHttpTest {
    @LocalServerPort int port;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    private final HttpClient http = HttpClient.newHttpClient();

    private HttpResponse<String> request(String method, String path, String cookie, String token, String body)
            throws Exception {
        var request = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path));
        if (cookie != null) request.header("Cookie", cookie);
        if (token != null) request.header("X-CSRF-TOKEN", token);
        if (body != null) request.header("Content-Type", "application/json");
        request.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body));
        return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    @Test
    void realServerRejectsOldCookieAfterLoginAndLogout() throws Exception {
        String email = "http-" + UUID.randomUUID() + "@example.com";
        String body = "{\"email\":\"" + email + "\",\"password\":\"password123\"}";
        try {
            var csrf = request("GET", "/api/auth/csrf", null, null, null);
            String setCookie = csrf.headers().firstValue("Set-Cookie").orElseThrow();
            assertThat(setCookie).contains("HttpOnly", "Secure", "SameSite=Lax", "Path=/");
            String anonymousCookie = setCookie.split(";", 2)[0];
            String token = json.readTree(csrf.body()).get("token").asText();
            assertThat(request("POST", "/api/auth/register", anonymousCookie, token, body).statusCode()).isEqualTo(201);
            assertThat(request("GET", "/api/auth/me", anonymousCookie, null, null).statusCode()).isEqualTo(401);
            var login = request("POST", "/api/auth/login", anonymousCookie, token, body);
            assertThat(login.statusCode()).isEqualTo(200);
            String authenticatedCookie = login.headers().firstValue("Set-Cookie").orElseThrow().split(";", 2)[0];
            assertThat(authenticatedCookie).isNotEqualTo(anonymousCookie);
            assertThat(request("GET", "/api/auth/me", anonymousCookie, null, null).statusCode()).isEqualTo(401);
            var me = request("GET", "/api/auth/me", authenticatedCookie, null, null);
            assertThat(me.statusCode()).isEqualTo(200);
            assertThat(json.readTree(me.body()).get("email").asText()).isEqualTo(email);
            assertThat(request("POST", "/api/auth/logout", authenticatedCookie, token, null).statusCode()).isEqualTo(403);
            var freshCsrf = request("GET", "/api/auth/csrf", authenticatedCookie, null, null);
            String freshToken = json.readTree(freshCsrf.body()).get("token").asText();
            var logout = request("POST", "/api/auth/logout", authenticatedCookie, freshToken, null);
            assertThat(logout.statusCode()).isEqualTo(204);
            assertThat(logout.body()).isEmpty();
            assertThat(logout.headers().firstValue("Set-Cookie").orElseThrow()).contains("Max-Age=0");
            assertThat(request("GET", "/api/auth/me", authenticatedCookie, null, null).statusCode()).isEqualTo(401);
            assertThat(request("POST", "/api/auth/logout", authenticatedCookie, freshToken, null).statusCode()).isEqualTo(401);
        } finally {
            users.findByEmail(email).ifPresent(users::delete);
        }
    }
}
