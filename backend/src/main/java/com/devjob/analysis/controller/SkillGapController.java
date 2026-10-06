package com.devjob.analysis.controller;

import com.devjob.analysis.dto.SkillGap;
import com.devjob.analysis.service.SkillGapService;
import com.devjob.auth.dto.CurrentUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me/skill-gap")
public class SkillGapController {
    private final SkillGapService service;
    public SkillGapController(SkillGapService service) { this.service = service; }

    @GetMapping
    public SkillGap get(@AuthenticationPrincipal CurrentUser user,
            @RequestParam(required = false) String desiredRole) {
        return service.find(user.id(), desiredRole);
    }
}
