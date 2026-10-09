package com.devjob.character;

import com.devjob.auth.config.SecurityConfig;
import com.devjob.auth.dto.CurrentUser;
import com.devjob.character.controller.CharacterController;
import com.devjob.character.service.CharacterService;
import com.devjob.character.service.CharacterGrowthService;
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

@WebMvcTest(CharacterController.class) @Import(SecurityConfig.class)
class CharacterSecurityTest {
    @Autowired MockMvc mvc;
    @MockitoBean CharacterService characters;
    @MockitoBean CharacterGrowthService growth;
    private org.springframework.test.web.servlet.request.RequestPostProcessor asUser() {
        return authentication(new UsernamePasswordAuthenticationToken(new CurrentUser(1L, "test@example.com"), null,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }
    @Test void allRoutesRequireLoginAndMutationRequiresCsrf() throws Exception {
        mvc.perform(get("/api/me/character")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/character/items")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/me/character/activity")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/me/character/quests")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/me/character/quests/TODO_1/claim").with(csrf()))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/me/character/quests/TODO_1/claim").with(asUser()))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/me/character/equipment/OUTFIT").with(csrf())
                .contentType("application/json").content("{\"itemId\":\"MINT\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(put("/api/me/character/equipment/OUTFIT").with(asUser())
                .contentType("application/json").content("{\"itemId\":\"MINT\"}"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(characters);
        verifyNoInteractions(growth);
    }
    @Test void controllerUsesAuthenticatedOwnerOnly() throws Exception {
        mvc.perform(put("/api/me/character/equipment/OUTFIT").with(asUser()).with(csrf())
                .contentType("application/json").content("{\"itemId\":\"MINT\"}"))
                .andExpect(status().isOk());
        verify(characters).equip(eq(1L), eq("OUTFIT"), any());
    }
    @Test void rejectsMalformedEquipmentBody() throws Exception {
        for (String body : List.of("{}", "[]", "{\"itemId\":12}",
                "{\"itemId\":\"MINT\",\"userId\":2}")) {
            mvc.perform(put("/api/me/character/equipment/OUTFIT").with(asUser()).with(csrf())
                    .contentType("application/json").content(body))
                    .andExpect(status().isBadRequest());
        }
        verifyNoInteractions(characters);
    }
    @Test void newRoutesUseAuthenticatedOwner() throws Exception {
        mvc.perform(get("/api/character/items").with(asUser())).andExpect(status().isOk());
        mvc.perform(get("/api/me/character/activity").with(asUser())).andExpect(status().isOk());
        mvc.perform(get("/api/me/character/quests").with(asUser())).andExpect(status().isOk());
        mvc.perform(post("/api/me/character/quests/TODO_1/claim").with(asUser()).with(csrf()))
                .andExpect(status().isOk());
        verify(characters).items(1L);
        verify(growth).activity(1L, 0, 20);
        verify(growth).quests(1L);
        verify(growth).claim(1L, "TODO_1");
    }
}
