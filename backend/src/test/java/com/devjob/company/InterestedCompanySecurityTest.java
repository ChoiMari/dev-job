package com.devjob.company;

import com.devjob.auth.config.SecurityConfig;
import com.devjob.auth.dto.CurrentUser;
import com.devjob.company.controller.InterestedCompanyController;
import com.devjob.company.service.InterestedCompanyService;
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

@WebMvcTest(InterestedCompanyController.class) @Import(SecurityConfig.class)
class InterestedCompanySecurityTest {
    @Autowired MockMvc mvc;
    @MockitoBean InterestedCompanyService companies;
    private org.springframework.test.web.servlet.request.RequestPostProcessor asUser() {
        return authentication(new UsernamePasswordAuthenticationToken(new CurrentUser(1L, "test@example.com"), null,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }
    @Test void protectsAllRoutesAndRequiresCsrfForMutations() throws Exception {
        mvc.perform(get("/api/me/companies")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/me/companies/1")).andExpect(status().isUnauthorized());
        for (var request : List.of(post("/api/me/companies"), patch("/api/me/companies/1"), delete("/api/me/companies/1"))) {
            mvc.perform(request.with(csrf())).andExpect(status().isUnauthorized());
        }
        for (var request : List.of(post("/api/me/companies"), patch("/api/me/companies/1"), delete("/api/me/companies/1"))) {
            mvc.perform(request.with(asUser())).andExpect(status().isForbidden());
        }
        verifyNoInteractions(companies);
    }
    @Test void rejectsMalformedCreateAndPatchBeforeService() throws Exception {
        for (String body : List.of("{}", "{", "{\"name\":\"  \",\"status\":\"INTERESTED\"}",
                "{\"name\":123,\"status\":\"INTERESTED\"}", "{\"name\":\"A\",\"status\":\"UNKNOWN\"}",
                "{\"name\":\"A\",\"status\":null}", "{\"name\":\"A\",\"status\":\"INTERESTED\",\"note\":123}",
                "{\"name\":\"" + "a".repeat(201) + "\",\"status\":\"INTERESTED\"}")) {
            mvc.perform(post("/api/me/companies").with(asUser()).with(csrf()).contentType("application/json").content(body))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        }
        for (String body : List.of("{}", "[]", "{\"name\":null}", "{\"status\":\"UNKNOWN\"}",
                "{\"note\":123}", "{\"unknown\":\"x\"}")) {
            mvc.perform(patch("/api/me/companies/1").with(asUser()).with(csrf()).contentType("application/json").content(body))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        }
        verifyNoInteractions(companies);
    }
}
