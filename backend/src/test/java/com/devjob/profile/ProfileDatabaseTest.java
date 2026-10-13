package com.devjob.profile;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.profile.repository.ProfileRepository;
import com.devjob.user.entity.User;
import com.devjob.user.repository.UserRepository;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Tag("database")
@EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_s04_test")
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class ProfileDatabaseTest {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired ProfileRepository profiles;

    private UsernamePasswordAuthenticationToken auth(User user) {
        return UsernamePasswordAuthenticationToken.authenticated(
                new CurrentUser(user.getId(), user.getEmail()), null, java.util.List.of());
    }
    private String body(String email, String nickname) {
        return "{\"email\":\"" + email + "\",\"nickname\":\"" + nickname + "\"}";
    }
    @Test void ownerCreatesUpdatesAndReadsOnlyOwnProfile() throws Exception {
        var first = users.saveAndFlush(new User("first-s04@example.com", "hash"));
        var second = users.saveAndFlush(new User("second-s04@example.com", "hash"));
        mvc.perform(get("/api/me/profile").with(authentication(auth(first))))
                .andExpect(status().isNotFound());
        mvc.perform(put("/api/me/profile").with(authentication(auth(first))).with(csrf())
                .param("userId", second.getId().toString()).header("X-User-Id", second.getId())
                .contentType("application/json").content(body(" First-S04@Example.com ", "첫 사용자")))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.email").value("first-s04@example.com"))
                .andExpect(jsonPath("$.nickname").value("첫 사용자"))
                .andExpect(jsonPath("$.desiredRole").value(org.hamcrest.Matchers.nullValue()));
        mvc.perform(get("/api/me/profile").with(authentication(auth(second))))
                .andExpect(status().isNotFound());
        mvc.perform(put("/api/me/profile").with(authentication(auth(first))).with(csrf())
                .contentType("application/json").content(body("first-s04@example.com", "수정됨")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.nickname").value("수정됨"));
        mvc.perform(get("/api/me/profile").with(authentication(auth(first))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.nickname").value("수정됨"));
        assertThat(profiles.findByUserId(first.getId())).isPresent();
        assertThat(profiles.findByUserId(second.getId())).isEmpty();
        assertThat(users.findById(first.getId()).orElseThrow().getEmail()).isEqualTo("first-s04@example.com");
    }
    @Test void validatesInputImmutableEmailAndCsrf() throws Exception {
        var first = users.saveAndFlush(new User("first-s04@example.com", "hash"));
        users.saveAndFlush(new User("second-s04@example.com", "hash"));
        mvc.perform(put("/api/me/profile").with(authentication(auth(first)))
                .contentType("application/json").content(body("first-s04@example.com", "이름")))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/me/profile").with(authentication(auth(first))).with(csrf())
                .contentType("application/json").content(body("second-s04@example.com", "이름")))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/me/profile").with(authentication(auth(first))).with(csrf())
                .contentType("application/json").content(body("first-s04@example.com", "   ")))
                .andExpect(status().isBadRequest());
        assertThat(profiles.findByUserId(first.getId())).isEmpty();
    }
}
