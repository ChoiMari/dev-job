package com.devjob.project.controller;

import com.devjob.project.service.ProjectImageService;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ProjectImageConfigurationController {
    private final ProjectImageService images;
    public ProjectImageConfigurationController(ProjectImageService images) { this.images = images; }
    @GetMapping("/api/me/project-image-storage") public Map<String, Boolean> configuration() {
        return Map.of("available", images.available());
    }
}
