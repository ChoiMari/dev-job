package com.devjob.auth;

import com.devjob.auth.config.SecurityConfig;
import com.devjob.auth.controller.AuthController;
import com.devjob.auth.dto.CurrentUser;
import com.devjob.auth.service.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
@Import(SecurityConfig.class)
class AuthSecurityTest {
    @Autowired MockMvc mvc;
    @MockitoBean AuthService auth;

    @Test
    void anonymousProtectedRoutesReturnJson401() throws Exception {
        for (String path : new String[]{"/api/auth/me", "/api/me/profile", "/api/me/skills", "/api/projects"}) {
            mvc.perform(get(path)).andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        }
        mvc.perform(post("/api/auth/logout")).andExpect(status().isUnauthorized());
        verifyNoInteractions(auth);
    }

    @Test
    void publicMutationsRequireCsrf() throws Exception {
        for (String path : new String[]{"/api/auth/register", "/api/auth/login"}) {
            mvc.perform(post(path).contentType("application/json")
                    .content("{\"email\":\"user@example.com\",\"password\":\"password123\"}"))
                    .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
        }
        verifyNoInteractions(auth);
    }

    @Test
    void csrfIsPublicAndOnlyExpectedMethodsArePublic() throws Exception {
        mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk())
                .andExpect(jsonPath("$.headerName").value("X-CSRF-TOKEN"))
                .andExpect(jsonPath("$.token").isNotEmpty());
        mvc.perform(get("/api/auth/register")).andExpect(status().isUnauthorized());
    }

    @Test
    void validatesMalformedAndOversizedCredentialsBeforeService() throws Exception {
        String[] bodies = {"{", "{}", "{\"email\":\"invalid\",\"password\":\"password123\"}",
                "{\"email\":\"user@example.com\",\"password\":\"short\"}",
                "{\"email\":\"user@example.com\",\"password\":\"" + "가".repeat(25) + "\"}"};
        for (String body : bodies) {
            mvc.perform(post("/api/auth/register").with(csrf()).contentType("application/json").content(body))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        }
        verifyNoInteractions(auth);
    }

    @Test
    void registrationKeepsResourceContractAndDoesNotLogIn() throws Exception {
        when(auth.register(any())).thenReturn(new CurrentUser(1L, "user@example.com"));
        var result = mvc.perform(post("/api/auth/register").with(csrf()).contentType("application/json")
                .content("{\"email\":\"user@example.com\",\"password\":\"password123\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.*").value(org.hamcrest.Matchers.hasSize(2)))
                .andReturn();
        mvc.perform(get("/api/auth/me").session((org.springframework.mock.web.MockHttpSession)
                result.getRequest().getSession())).andExpect(status().isUnauthorized());
    }
}
