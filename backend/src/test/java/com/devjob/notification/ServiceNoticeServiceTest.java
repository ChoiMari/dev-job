package com.devjob.notification;

import com.devjob.auth.dto.CurrentUser;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ServiceNoticeServiceTest {
    @Test void onlyConfiguredAdministratorCanPublishValidTitle() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        NotificationEventRecorder recorder = mock(NotificationEventRecorder.class);
        var service = new ServiceNoticeService(jdbc, recorder, "admin@example.com");
        assertThatThrownBy(() -> service.publish(new CurrentUser(2L, "member@example.com"), "안내"))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("403");
        assertThatThrownBy(() -> service.publish(new CurrentUser(1L, "admin@example.com"), "  "))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("400");
        verifyNoInteractions(jdbc);
        when(jdbc.queryForObject(startsWith("insert into service_notice"),
                any(org.springframework.jdbc.core.RowMapper.class), eq(1L), eq("새 공지")))
                .thenReturn(new ServiceNoticeService.Notice(3L, "새 공지", java.time.Instant.now()));
        service.publish(new CurrentUser(1L, "ADMIN@example.com"), "새 공지");
        verify(jdbc).queryForObject(startsWith("insert into service_notice"), any(org.springframework.jdbc.core.RowMapper.class),
                eq(1L), eq("새 공지"));
        verify(recorder).record(eq(NotificationType.SERVICE_NOTICE), eq(3L), any(java.time.Instant.class));
    }
}
