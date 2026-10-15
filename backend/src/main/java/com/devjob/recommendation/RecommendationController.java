package com.devjob.recommendation;

import com.devjob.auth.dto.CurrentUser;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/me/recommendations/jobs")
public class RecommendationController {
    private final RecommendationService service;
    public RecommendationController(RecommendationService service) { this.service = service; }
    @PostMapping
    public ResponseEntity<RecommendationService.Page> request(@AuthenticationPrincipal CurrentUser user,
            @RequestBody JsonNode body) {
        var result = service.request(user.id(), body);
        return ResponseEntity.status(result.accepted() ? 202 : 200).body(result.body());
    }
    @GetMapping
    public RecommendationService.Page list(@AuthenticationPrincipal CurrentUser user, @RequestParam long requestId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.get(user.id(), requestId, page, size);
    }
    @GetMapping("/history")
    public RecommendationService.HistoryPage history(@AuthenticationPrincipal CurrentUser user,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
        return service.history(user.id(), page, size);
    }
    @GetMapping("/{id}")
    public RecommendationService.Page get(@AuthenticationPrincipal CurrentUser user, @PathVariable long id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.get(user.id(), id, page, size);
    }
}
