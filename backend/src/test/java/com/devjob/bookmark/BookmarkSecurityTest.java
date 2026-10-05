package com.devjob.bookmark;

import com.devjob.auth.config.SecurityConfig;
import com.devjob.auth.dto.CurrentUser;
import com.devjob.bookmark.controller.BookmarkController;
import com.devjob.bookmark.service.BookmarkService;
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

@WebMvcTest(BookmarkController.class) @Import(SecurityConfig.class)
class BookmarkSecurityTest {
    @Autowired MockMvc mvc;
    @MockitoBean BookmarkService bookmarks;
    private org.springframework.test.web.servlet.request.RequestPostProcessor authenticated() {
        return authentication(new UsernamePasswordAuthenticationToken(new CurrentUser(1L, "test@example.com"), null,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))));
    }
    @Test void protectsRoutesAndRequiresCsrfBeforeService() throws Exception {
        mvc.perform(get("/api/bookmarks")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/bookmarks").with(csrf()).contentType("application/json").content("{\"jobId\":1}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/bookmarks/1").with(csrf())).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/bookmarks").with(authenticated()).contentType("application/json").content("{\"jobId\":1}"))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/bookmarks/1").with(authenticated())).andExpect(status().isForbidden());
        verifyNoInteractions(bookmarks);
    }
    @Test void rejectsNonIntegerMissingAndOutOfRangeJobIds() throws Exception {
        for (String body : new String[]{"{", "{}", "{\"jobId\":null}", "{\"jobId\":0}", "{\"jobId\":-1}",
                "{\"jobId\":1.5}", "{\"jobId\":\"1\"}", "{\"jobId\":true}", "{\"jobId\":9223372036854775808}"}) {
            mvc.perform(post("/api/bookmarks").with(authenticated()).with(csrf()).contentType("application/json").content(body))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        }
        verifyNoInteractions(bookmarks);
    }
}
