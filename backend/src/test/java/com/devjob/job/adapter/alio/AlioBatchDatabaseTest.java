package com.devjob.job.adapter.alio;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.job.service.AlioBatchService;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Tag("database")
@EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_b11_batch_test")
@SpringBootTest(properties = {"ALIO_SERVICE_KEY=fixture-key", "ALIO_BATCH_ADMIN_EMAILS=operator@example.com"})
@AutoConfigureMockMvc
class AlioBatchDatabaseTest {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired AlioBatchService batch;
    @MockitoBean AlioHttpClient client;

    @Test
    void adminBatchTraversesAllPagesAndRepeatedRunUpdatesWithoutDuplicates() throws Exception {
        assertThat(jdbc.queryForObject("select current_database()", String.class))
                .isEqualTo("devjob_b11_batch_test");
        var admin = user("operator@example.com");
        var ordinary = user("ordinary@example.com");
        mvc.perform(get("/api/admin/jobs/collections/alio")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/admin/jobs/collections/alio").with(authentication(ordinary)))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/jobs/collections/alio").with(authentication(admin)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/jobs/collections/alio").with(authentication(admin)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("IDLE"));

        var detailStarted = new CountDownLatch(1);
        var releaseDetail = new CountDownLatch(1);
        var failSecondPage = new AtomicBoolean(false);
        when(client.post(any())).thenAnswer(invocation -> {
            URI uri = invocation.getArgument(0);
            if (uri.getPath().endsWith("list.do")) {
                if (failSecondPage.get() && uri.getRawQuery().contains("pageNo=2"))
                    return bytes("{\"resultCode\":5}");
                return bytes(uri.getRawQuery().contains("pageNo=1") ? list(1, 20) : list(21, 21));
            }
            if (uri.getRawQuery().contains("sn=1")) {
                detailStarted.countDown();
                assertThat(releaseDetail.await(5, TimeUnit.SECONDS)).isTrue();
            }
            int id = Integer.parseInt(uri.getRawQuery().replaceAll(".*[?&]sn=(\\d+).*", "$1"));
            return bytes(detail(id));
        });
        try {
            mvc.perform(post("/api/admin/jobs/collections/alio").with(authentication(admin)).with(csrf()))
                    .andExpect(status().isAccepted());
            assertThat(detailStarted.await(5, TimeUnit.SECONDS)).isTrue();
            mvc.perform(post("/api/admin/jobs/collections/alio").with(authentication(admin)).with(csrf()))
                    .andExpect(status().isConflict());
            mvc.perform(get("/api/admin/jobs/collections/alio").with(authentication(admin)))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("RUNNING"));
        } finally {
            releaseDetail.countDown();
        }
        awaitCompletion(admin, "COMPLETED");
        assertThat(jdbc.queryForObject("select count(*) from job_posting", Integer.class)).isEqualTo(21);
        assertThat(jdbc.queryForObject("select count(*) from job_source where code='ALIO_RECRUITMENT'", Integer.class))
                .isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from job_posting where title='현장 통신 채용'", Integer.class))
                .isEqualTo(1); // This title is intentionally outside the previous IT-title filter.
        mvc.perform(get("/api/admin/jobs/collections/alio").with(authentication(admin)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.processedPages").value(2))
                .andExpect(jsonPath("$.created").value(21))
                .andExpect(jsonPath("$.duplicates").value(0));

        mvc.perform(post("/api/admin/jobs/collections/alio").with(authentication(admin)).with(csrf()))
                .andExpect(status().isAccepted());
        awaitCompletion(admin, "COMPLETED");
        assertThat(jdbc.queryForObject("select count(*) from job_posting", Integer.class)).isEqualTo(21);
        mvc.perform(get("/api/admin/jobs/collections/alio").with(authentication(admin)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.created").value(0))
                .andExpect(jsonPath("$.duplicates").value(21));

        failSecondPage.set(true);
        mvc.perform(post("/api/admin/jobs/collections/alio").with(authentication(admin)).with(csrf()))
                .andExpect(status().isAccepted());
        awaitCompletion(admin, "PARTIAL_FAILURE");
        assertThat(jdbc.queryForObject("select count(*) from job_posting", Integer.class)).isEqualTo(21);
        mvc.perform(get("/api/admin/jobs/collections/alio").with(authentication(admin)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.processedPages").value(1))
                .andExpect(jsonPath("$.sourceError").value("PROVIDER_CONNECTION"));
    }

    private void awaitCompletion(UsernamePasswordAuthenticationToken admin, String expected) throws Exception {
        for (int i = 0; i < 100; i++) {
            String status = batch.status((CurrentUser) admin.getPrincipal()).status();
            if (!"RUNNING".equals(status)) {
                assertThat(status).isEqualTo(expected);
                return;
            }
            Thread.sleep(100);
        }
        fail("ALIO batch did not finish within ten seconds");
    }

    private UsernamePasswordAuthenticationToken user(String email) {
        long id = jdbc.queryForObject("insert into users (email, password_hash, created_at) "
                + "values (?, 'fixture', now()) returning id", Long.class, email);
        return UsernamePasswordAuthenticationToken.authenticated(new CurrentUser(id, email), null, List.of());
    }

    private static byte[] bytes(String json) { return json.getBytes(StandardCharsets.UTF_8); }

    private static String list(int first, int last) {
        var rows = new java.util.ArrayList<String>();
        for (int id = first; id <= last; id++) rows.add("""
                {"recrutPblntSn":%d,"instNm":"공공기관","recrutPbancTtl":"%s",
                 "ncsCdLst":"R600020","srcUrl":"https://example.com/alio/%d",
                 "pbancBgngYmd":"20261001","pbancEndYmd":"20261020"}
                """.formatted(id, id == 1 ? "현장 통신 채용" : "전산 채용 " + id, id));
        return "{\"resultCode\":200,\"totalCount\":21,\"result\":[" + String.join(",", rows) + "]}";
    }

    private static String detail(int id) {
        return """
                {"resultCode":200,"result":{"recrutPblntSn":%d,"instNm":"공공기관",
                "recrutPbancTtl":"%s","srcUrl":"https://example.com/alio/%d",
                "aplyQlfcCn":"공개 자격"}}
                """.formatted(id, id == 1 ? "현장 통신 채용" : "전산 채용 " + id, id);
    }
}
