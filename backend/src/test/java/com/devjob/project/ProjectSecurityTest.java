package com.devjob.project;

import com.devjob.auth.config.SecurityConfig;
import com.devjob.auth.dto.CurrentUser;
import com.devjob.project.controller.ProjectController;
import com.devjob.project.service.ProjectService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ProjectController.class) @Import(SecurityConfig.class)
class ProjectSecurityTest {
    @Autowired MockMvc mvc;
    @MockitoBean ProjectService projects;
    private org.springframework.test.web.servlet.request.RequestPostProcessor asUser() {
        return authentication(new UsernamePasswordAuthenticationToken(new CurrentUser(1L, "test@example.com"), null,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }
    @Test void protectsEveryRouteAndMutationCsrf() throws Exception {
        mvc.perform(get("/api/me/projects")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/me/projects/1")).andExpect(status().isUnauthorized());
        for (var request : List.of(post("/api/me/projects"), put("/api/me/projects/1"), delete("/api/me/projects/1"))) {
            mvc.perform(request.with(csrf())).andExpect(status().isUnauthorized());
        }
        for (var request : List.of(post("/api/me/projects"), put("/api/me/projects/1"), delete("/api/me/projects/1"))) {
            mvc.perform(request.with(asUser())).andExpect(status().isForbidden());
        }
        verifyNoInteractions(projects);
    }
    @Test void rejectsInvalidInputBeforeService() throws Exception {
        String valid = "{\"name\":\"Test\",\"startDate\":\"2026-01-01\",\"skillIds\":[]}";
        for (String input : List.of("{", "{}", valid.replace("Test", "  "), valid.replace("Test", "a".repeat(101)),
                valid.replace("\"Test\"", "123"), valid.replace("2026-01-01", "2026-02-30"),
                valid.replace("[]", "null"), valid.replace("[]", "[null]"), valid.replace("[]", "[0]"),
                valid.replace("[]", "[1.5]"), valid.replace("[]", "[\"1\"]"), valid.replace("[]", "[-1]"),
                valid.replace("[]", "[9223372036854775808]"), valid.replace("Test", "Bad\\u0000Text"),
                valid.replace("}", ",\"endDate\":\"2025-12-31\"}"),
                valid.replace("}", ",\"role\":\"" + "r".repeat(101) + "\"}"),
                valid.replace("}", ",\"description\":\"" + "d".repeat(2001) + "\"}"))) {
            mvc.perform(post("/api/me/projects").with(asUser()).with(csrf()).contentType("application/json").content(input))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        }
        verifyNoInteractions(projects);
    }
    @Test void rejectsUnsafeUrlsAndAcceptsOptionalNulls() throws Exception {
        for (String url : List.of("javascript:alert(1)", "ftp://example.com/a", "/relative", "https://", "https://user:pass@example.com", "https://example.com/a b")) {
            mvc.perform(put("/api/me/projects/1").with(asUser()).with(csrf()).contentType("application/json")
                    .content("{\"name\":\"Test\",\"startDate\":\"2026-01-01\",\"skillIds\":[],\"projectUrl\":\"" + url + "\"}"))
                    .andExpect(status().isBadRequest());
        }
        verifyNoInteractions(projects);
        mvc.perform(post("/api/me/projects").with(asUser()).with(csrf()).contentType("application/json")
                .content("{\"name\":\"Test\",\"startDate\":\"2026-01-01\",\"skillIds\":[],\"projectUrl\":null}"))
                .andExpect(status().isCreated());
        verify(projects).create(eq(1L), any());
    }
}
