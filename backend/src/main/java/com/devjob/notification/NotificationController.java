package com.devjob.notification;

import com.devjob.auth.dto.CurrentUser;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class NotificationController {
    private final NotificationService service;
    private final ServiceNoticeService notices;
    public NotificationController(NotificationService service, ServiceNoticeService notices) {
        this.service = service; this.notices = notices;
    }

    public record PublishNoticeRequest(String title) { }

    @PostMapping("/api/admin/notifications/service-notices")
    @ResponseStatus(HttpStatus.CREATED)
    public ServiceNoticeService.Notice publishNotice(@AuthenticationPrincipal CurrentUser user,
            @RequestBody PublishNoticeRequest input) {
        return notices.publish(user, input == null ? null : input.title());
    }

    @GetMapping("/api/me/notification-preferences")
    public NotificationPreferences preferences(@AuthenticationPrincipal CurrentUser user) {
        return service.preferences(user.id());
    }

    @PutMapping("/api/me/notification-preferences")
    public NotificationPreferences savePreferences(@AuthenticationPrincipal CurrentUser user,
            @RequestBody JsonNode input) {
        return service.savePreferences(user.id(), input);
    }

    @GetMapping("/api/me/notifications")
    public NotificationPage list(@AuthenticationPrincipal CurrentUser user,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.list(user.id(), page, size);
    }

    @PatchMapping("/api/me/notifications/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markRead(@AuthenticationPrincipal CurrentUser user, @PathVariable long id) {
        service.markRead(user.id(), id);
    }
}
