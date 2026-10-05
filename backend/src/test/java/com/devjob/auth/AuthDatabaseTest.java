package com.devjob.auth;

import com.devjob.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Tag("database")
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AuthDatabaseTest {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder passwords;
    @Autowired ObjectMapper json;

    private record Token(MockHttpSession session, String value) { }
    private Token token(MockHttpSession session) throws Exception {
        var request = get("/api/auth/csrf");
        if (session != null) request.session(session);
        var result = mvc.perform(request).andExpect(status().isOk()).andReturn();
        return new Token((MockHttpSession) result.getRequest().getSession(),
                json.readTree(result.getResponse().getContentAsString()).get("token").asText());
    }

    private void register(String email) throws Exception {
        var token = token(null);
        mvc.perform(post("/api/auth/register").session(token.session()).header("X-CSRF-TOKEN", token.value())
                .contentType("application/json").content(body(email)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.passwordHash").doesNotExist());
    }

    private String body(String email) {
        return "{\"email\":\"" + email + "\",\"password\":\"password123\"}";
    }

    private MockHttpSession login(String email) throws Exception {
        var token = token(null);
        String oldId = token.session().getId();
        mvc.perform(post("/api/auth/login").session(token.session()).header("X-CSRF-TOKEN", token.value())
                .contentType("application/json").content(body(email)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.user.email").value(email));
        assertThat(token.session().getId()).isNotEqualTo(oldId);
        // A token obtained before login is no longer valid after authentication.
        mvc.perform(post("/api/auth/logout").session(token.session()).header("X-CSRF-TOKEN", token.value()))
                .andExpect(status().isForbidden());
        return token.session();
    }

    @Test
    void registerLoginMeLogoutAndSessionReplay() throws Exception {
        register("flow@example.com");
        var stored = users.findByEmail("flow@example.com").orElseThrow();
        assertThat(stored.getPasswordHash()).isNotEqualTo("password123");
        assertThat(passwords.matches("password123", stored.getPasswordHash())).isTrue();
        var session = login("flow@example.com");
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(stored.getId()))
                .andExpect(jsonPath("$.*").value(org.hamcrest.Matchers.hasSize(2)));
        mvc.perform(post("/api/auth/logout").session(session)).andExpect(status().isForbidden());
        var token = token(session);
        mvc.perform(post("/api/auth/logout").session(session).header("X-CSRF-TOKEN", token.value()))
                .andExpect(status().isNoContent()).andExpect(content().string(""))
                .andExpect(cookie().maxAge("JSESSIONID", 0));
        assertThat(session.isInvalid()).isTrue();
        mvc.perform(get("/api/auth/me").cookie(new jakarta.servlet.http.Cookie("JSESSIONID", session.getId())))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/logout")).andExpect(status().isUnauthorized());
    }

    @Test
    void normalizedEmailDuplicateReturns409() throws Exception {
        register("duplicate@example.com");
        var token = token(null);
        mvc.perform(post("/api/auth/register").session(token.session()).header("X-CSRF-TOKEN", token.value())
                .contentType("application/json").content(body(" Duplicate@Example.com ")))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("CONFLICT"));
    }

    @Test
    void separateSessionsCannotSelectAnotherUserWithSuppliedId() throws Exception {
        register("first@example.com");
        register("second@example.com");
        var first = login("first@example.com");
        var second = login("second@example.com");
        var secondId = users.findByEmail("second@example.com").orElseThrow().getId();
        mvc.perform(get("/api/auth/me").session(first).param("userId", secondId.toString())
                .header("X-User-Id", secondId)).andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("first@example.com"));
        mvc.perform(get("/api/auth/me").session(second)).andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("second@example.com"));
        var token = token(first);
        mvc.perform(post("/api/auth/logout").session(first).header("X-CSRF-TOKEN", token.value()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/auth/me").session(second)).andExpect(status().isOk());
    }

    @Test
    void wrongPasswordAndUnknownAccountAre401() throws Exception {
        register("credentials@example.com");
        for (String email : new String[]{"credentials@example.com", "missing@example.com"}) {
            var token = token(null);
            mvc.perform(post("/api/auth/login").session(token.session()).header("X-CSRF-TOKEN", token.value())
                    .contentType("application/json").content(body(email).replace("password123", "incorrect123")))
                    .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
            mvc.perform(get("/api/auth/me").session(token.session())).andExpect(status().isUnauthorized());
        }
    }
}
