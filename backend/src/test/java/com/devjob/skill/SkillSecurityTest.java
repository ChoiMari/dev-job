package com.devjob.skill;

import com.devjob.auth.config.SecurityConfig;
import com.devjob.auth.dto.CurrentUser;
import com.devjob.skill.controller.SkillController;
import com.devjob.skill.service.SkillService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(SkillController.class)
@Import(SecurityConfig.class)
class SkillSecurityTest {
    @Autowired MockMvc mvc;
    @MockitoBean SkillService skills;
    private org.springframework.test.web.servlet.request.RequestPostProcessor authenticated() {
        return authentication(new UsernamePasswordAuthenticationToken(new CurrentUser(1L, "test@example.com"), null,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }
    @Test void protectsAllSkillRoutesAndRequiresCsrf() throws Exception {
        mvc.perform(get("/api/skills")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/me/skills")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/me/skills").with(csrf()).contentType("application/json").content("{\"skillId\":1}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/me/skills/1")).andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/me/skills/1/experience").with(csrf()).contentType("application/json")
                .content("{\"proficiencyLevel\":3}")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/me/skills").with(authenticated()).contentType("application/json").content("{\"skillId\":1}"))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/me/skills/1").with(authenticated())).andExpect(status().isForbidden());
        mvc.perform(patch("/api/me/skills/1/experience").with(authenticated()).contentType("application/json")
                .content("{\"proficiencyLevel\":3}")).andExpect(status().isForbidden());
        verifyNoInteractions(skills);
    }
    @Test void rejectsMalformedOrAmbiguousSelectionBeforeService() throws Exception {
        for (String input : new String[]{"{", "{}", "{\"skillId\":0}", "{\"skillId\":-1}",
                "{\"skillId\":1.5}", "{\"skillId\":\"1\"}", "{\"name\":123}",
                "{\"skillId\":1,\"name\":\"Java\"}", "{\"name\":\"" + "a".repeat(101) + "\"}"}) {
            mvc.perform(post("/api/me/skills").with(authenticated()).with(csrf()).contentType("application/json").content(input))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        }
        verifyNoInteractions(skills);
    }
    @Test void rejectsInvalidExperienceBodiesBeforeService() throws Exception {
        for (String input : new String[]{"{}", "[]", "null", "{\"unknown\":1}",
                "{\"proficiencyLevel\":0}", "{\"proficiencyLevel\":6}",
                "{\"experienceMonths\":-1}", "{\"experienceMonths\":601}",
                "{\"proficiencyLevel\":1.5}", "{\"experienceMonths\":\"24\"}",
                "{\"proficiencyLevel\":true}"}) {
            mvc.perform(patch("/api/me/skills/1/experience").with(authenticated()).with(csrf())
                    .contentType("application/json").content(input))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        }
        verifyNoInteractions(skills);
    }
}
