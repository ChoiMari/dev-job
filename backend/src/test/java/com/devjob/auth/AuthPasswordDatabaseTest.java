package com.devjob.auth;

import com.devjob.auth.dto.PasswordChangeRequest;
import com.devjob.auth.service.AuthService;
import com.devjob.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Tag("database")
@SpringBootTest
@AutoConfigureMockMvc
class AuthPasswordDatabaseTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder passwords;
    @Autowired AuthService auth;

    private record Token(MockHttpSession session, String value) { }

    private Token csrf(MockHttpSession session) throws Exception {
        var request = get("/api/auth/csrf");
        if (session != null) request.session(session);
        var result = mvc.perform(request).andExpect(status().isOk()).andReturn();
        return new Token((MockHttpSession) result.getRequest().getSession(),
                json.readTree(result.getResponse().getContentAsString()).get("token").asText());
    }

    private String credentials(String email, String password) {
        return "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}";
    }

    private String change(String current, String next) {
        return "{\"currentPassword\":\"" + current + "\",\"newPassword\":\"" + next + "\"}";
    }

    private void register(String email) throws Exception {
        var token = csrf(null);
        mvc.perform(post("/api/auth/register").session(token.session()).header("X-CSRF-TOKEN", token.value())
                .contentType("application/json").content(credentials(email, "password123")))
                .andExpect(status().isCreated());
    }

    private MockHttpSession login(String email, String password) throws Exception {
        var token = csrf(null);
        mvc.perform(post("/api/auth/login").session(token.session()).header("X-CSRF-TOKEN", token.value())
                .contentType("application/json").content(credentials(email, password)))
                .andExpect(status().isOk());
        return token.session();
    }

    @Test
    void changesPasswordAndRevokesAllExistingSessions() throws Exception {
        String email = "password-" + UUID.randomUUID() + "@example.com";
        String otherEmail = "other-" + UUID.randomUUID() + "@example.com";
        try {
            register(email);
            register(otherEmail);
            var current = login(email, "password123");
            var other = login(email, "password123");
            var otherMutation = login(email, "password123");
            var legacy = login(email, "password123");
            legacy.removeAttribute("DEVJOB_CREDENTIAL_VERSION");
            var unrelated = login(otherEmail, "password123");
            var token = csrf(current);
            mvc.perform(patch("/api/auth/password").session(current).contentType("application/json")
                    .content(change("password123", "replacement123")))
                    .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
            mvc.perform(patch("/api/auth/password").session(current).header("X-CSRF-TOKEN", token.value())
                    .contentType("application/json").content(change("password123", "replacement123")))
                    .andExpect(status().isNoContent()).andExpect(content().string(""))
                    .andExpect(cookie().maxAge("JSESSIONID", 0));
            assertThat(current.isInvalid()).isTrue();
            var stored = users.findByEmail(email).orElseThrow();
            assertThat(stored.getCredentialVersion()).isEqualTo(1);
            assertThat(passwords.matches("replacement123", stored.getPasswordHash())).isTrue();
            mvc.perform(patch("/api/auth/password").session(otherMutation).contentType("application/json")
                    .content(change("password123", "another123")))
                    .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
            mvc.perform(get("/api/auth/me").session(other)).andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
            mvc.perform(get("/api/me/skills").session(legacy)).andExpect(status().isUnauthorized());
            mvc.perform(get("/api/auth/me").session(unrelated)).andExpect(status().isOk());
            var oldLogin = csrf(null);
            mvc.perform(post("/api/auth/login").session(oldLogin.session())
                    .header("X-CSRF-TOKEN", oldLogin.value()).contentType("application/json")
                    .content(credentials(email, "password123"))).andExpect(status().isUnauthorized());
            var fresh = login(email, "replacement123");
            mvc.perform(get("/api/auth/me").session(fresh)).andExpect(status().isOk());
        } finally {
            users.findByEmail(email).ifPresent(users::delete);
            users.findByEmail(otherEmail).ifPresent(users::delete);
        }
    }

    @Test
    void invalidInputAndWrongCurrentPasswordLeaveHashAndSessionsUntouched() throws Exception {
        String email = "invalid-password-" + UUID.randomUUID() + "@example.com";
        try {
            register(email);
            var session = login(email, "password123");
            var token = csrf(session);
            String originalHash = users.findByEmail(email).orElseThrow().getPasswordHash();
            for (String body : new String[]{"{}", change("가".repeat(25), "replacement123"),
                    change("password123", "short"),
                    change("password123", "password123"), change("password123", "가".repeat(25))}) {
                mvc.perform(patch("/api/auth/password").session(session).header("X-CSRF-TOKEN", token.value())
                        .contentType("application/json").content(body))
                        .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_INPUT"));
            }
            mvc.perform(patch("/api/auth/password").session(session).header("X-CSRF-TOKEN", token.value())
                    .contentType("application/json").content(change("incorrect123", "replacement123")))
                    .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
            assertThat(session.isInvalid()).isFalse();
            mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk());
            var stored = users.findByEmail(email).orElseThrow();
            assertThat(stored.getPasswordHash()).isEqualTo(originalHash);
            assertThat(stored.getCredentialVersion()).isZero();
        } finally {
            users.findByEmail(email).ifPresent(users::delete);
        }
    }

    @Test
    void concurrentChangesRecheckCurrentPasswordUnderUserLock() throws Exception {
        String email = "concurrent-password-" + UUID.randomUUID() + "@example.com";
        try {
            register(email);
            long id = users.findByEmail(email).orElseThrow().getId();
            var start = new CountDownLatch(1);
            var executor = Executors.newFixedThreadPool(2);
            try {
                var first = executor.submit(() -> {
                    start.await();
                    try { auth.changePassword(id, new PasswordChangeRequest("password123", "replacement123")); return 204; }
                    catch (ResponseStatusException error) { return error.getStatusCode().value(); }
                });
                var second = executor.submit(() -> {
                    start.await();
                    try { auth.changePassword(id, new PasswordChangeRequest("password123", "different123")); return 204; }
                    catch (ResponseStatusException error) { return error.getStatusCode().value(); }
                });
                start.countDown();
                assertThat(new int[]{first.get(), second.get()}).containsExactlyInAnyOrder(204, 401);
            } finally {
                executor.shutdownNow();
            }
            assertThat(users.findByEmail(email).orElseThrow().getCredentialVersion()).isEqualTo(1);
        } finally {
            users.findByEmail(email).ifPresent(users::delete);
        }
    }
}
