package com.devjob.documentanalysis.controller;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.documentanalysis.dto.DocumentAnalysisResponse;
import com.devjob.documentanalysis.service.DocumentAnalysisService;
import com.devjob.documentanalysis.service.DocumentAnalysisService.Type;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
public class DocumentAnalysisController {
    private final DocumentAnalysisService service;
    public DocumentAnalysisController(DocumentAnalysisService service) { this.service = service; }

    @PostMapping("/api/me/resumes/{documentId}/versions/{versionId}/analysis")
    public ResponseEntity<DocumentAnalysisResponse> requestResume(@AuthenticationPrincipal CurrentUser user,
            @PathVariable Long documentId, @PathVariable Long versionId, @RequestBody JsonNode body) {
        return requested(service.request(Type.RESUME, user.id(), documentId, versionId, body));
    }
    @GetMapping("/api/me/resumes/{documentId}/versions/{versionId}/analysis")
    public DocumentAnalysisResponse getResume(@AuthenticationPrincipal CurrentUser user,
            @PathVariable Long documentId, @PathVariable Long versionId) {
        return service.get(Type.RESUME, user.id(), documentId, versionId);
    }
    @DeleteMapping("/api/me/resumes/{documentId}/versions/{versionId}/analysis") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteResume(@AuthenticationPrincipal CurrentUser user,
            @PathVariable Long documentId, @PathVariable Long versionId) {
        service.delete(Type.RESUME, user.id(), documentId, versionId);
    }
    @PostMapping("/api/me/cover-letters/{documentId}/versions/{versionId}/analysis")
    public ResponseEntity<DocumentAnalysisResponse> requestCover(@AuthenticationPrincipal CurrentUser user,
            @PathVariable Long documentId, @PathVariable Long versionId, @RequestBody JsonNode body) {
        return requested(service.request(Type.COVER_LETTER, user.id(), documentId, versionId, body));
    }
    @GetMapping("/api/me/cover-letters/{documentId}/versions/{versionId}/analysis")
    public DocumentAnalysisResponse getCover(@AuthenticationPrincipal CurrentUser user,
            @PathVariable Long documentId, @PathVariable Long versionId) {
        return service.get(Type.COVER_LETTER, user.id(), documentId, versionId);
    }
    @DeleteMapping("/api/me/cover-letters/{documentId}/versions/{versionId}/analysis") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCover(@AuthenticationPrincipal CurrentUser user,
            @PathVariable Long documentId, @PathVariable Long versionId) {
        service.delete(Type.COVER_LETTER, user.id(), documentId, versionId);
    }
    private static ResponseEntity<DocumentAnalysisResponse> requested(DocumentAnalysisService.RequestResult result) {
        return ResponseEntity.status(result.accepted() ? 202 : 200).body(result.body());
    }
}
