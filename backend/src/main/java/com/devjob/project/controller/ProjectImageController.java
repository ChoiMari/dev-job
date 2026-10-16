package com.devjob.project.controller;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.project.service.ProjectImageService;
import com.devjob.project.service.ProjectImageService.ImageView;
import com.devjob.project.service.ProjectImageService.InitRequest;
import com.devjob.project.service.ProjectImageService.UploadTicket;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/me/projects/{projectId}/images")
public class ProjectImageController {
    private final ProjectImageService images;
    public ProjectImageController(ProjectImageService images) { this.images = images; }
    @GetMapping public List<ImageView> list(@AuthenticationPrincipal CurrentUser user, @PathVariable Long projectId) {
        return images.list(user.id(), projectId);
    }
    @PostMapping("/uploads") @ResponseStatus(HttpStatus.CREATED)
    public UploadTicket initiate(@AuthenticationPrincipal CurrentUser user, @PathVariable Long projectId,
            @RequestBody InitRequest request) { return images.initiate(user.id(), projectId, request); }
    @PostMapping("/{imageId}/complete")
    public ImageView complete(@AuthenticationPrincipal CurrentUser user, @PathVariable Long projectId,
            @PathVariable Long imageId) { return images.complete(user.id(), projectId, imageId); }
    @DeleteMapping("/{imageId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@AuthenticationPrincipal CurrentUser user, @PathVariable Long projectId,
            @PathVariable Long imageId) { images.remove(user.id(), projectId, imageId); }
}
