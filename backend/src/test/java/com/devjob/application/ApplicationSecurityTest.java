package com.devjob.application;

import com.devjob.application.controller.ApplicationController;
import com.devjob.application.service.ApplicationService;
import com.devjob.auth.config.SecurityConfig;
import com.devjob.auth.dto.CurrentUser;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ApplicationController.class)
@Import(SecurityConfig.class)
class ApplicationSecurityTest {
    @Autowired MockMvc mvc;
    @MockitoBean ApplicationService service;
    final UsernamePasswordAuthenticationToken owner = UsernamePasswordAuthenticationToken.authenticated(
            new CurrentUser(11L, "s11@example.com"), null, List.of());

    @Test void allEndpointsRequireSessionAndMutationsRequireCsrf() throws Exception {
        for (String path : List.of("/api/applications", "/api/applications/1", "/api/applications/1/history"))
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/applications")).andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/applications/1")).andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/applications/1/status")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/applications").with(authentication(owner)).contentType("application/json")
                .content("{\"jobId\":1,\"status\":\"PLANNED\"}")).andExpect(status().isForbidden());
        for (String suffix : List.of("", "/status"))
            mvc.perform(patch("/api/applications/1" + suffix).with(authentication(owner)).contentType("application/json")
                    .content("{}")).andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }
    @Test void strictCreateTypesAndDatesFailBeforeTheService() throws Exception {
        for (String body : List.of("null", "[]", "{}", "{\"jobId\":\"1\",\"status\":\"PLANNED\"}",
                "{\"jobId\":1.2,\"status\":\"PLANNED\"}", "{\"jobId\":0,\"status\":\"PLANNED\"}",
                "{\"jobId\":1,\"status\":2}", "{\"jobId\":1,\"status\":\"unknown\"}",
                "{\"jobId\":1,\"status\":\"APPLIED\",\"appliedDate\":\"2026-02-30\"}",
                "{\"jobId\":1,\"status\":\"PLANNED\",\"nextScheduleAt\":\"2026-10-10T14:00:00\"}",
                "{\"jobId\":1,\"status\":\"PLANNED\",\"note\":2}",
                "{\"jobId\":1,\"status\":\"PLANNED\",\"note\":\"" + "x".repeat(2001) + "\"}",
                "{\"jobId\":1,\"status\":\"PLANNED\",\"userId\":22}")) {
            mvc.perform(post("/api/applications").with(authentication(owner)).with(csrf())
                    .contentType("application/json").content(body))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        }
        verifyNoInteractions(service);
    }
    @Test void partialPatchRejectsEmptyUnknownAndWrongTypedFields() throws Exception {
        for (String body : List.of("{}", "null", "{\"status\":\"APPLIED\"}", "{\"note\":false}",
                "{\"nextScheduleAt\":\"not-a-date\"}"))
            mvc.perform(patch("/api/applications/1").with(authentication(owner)).with(csrf())
                    .contentType("application/json").content(body)).andExpect(status().isBadRequest());
        mvc.perform(patch("/api/applications/1/status").with(authentication(owner)).with(csrf())
                .contentType("application/json").content("{\"status\":null}")).andExpect(status().isBadRequest());
        verifyNoInteractions(service);
    }
}
