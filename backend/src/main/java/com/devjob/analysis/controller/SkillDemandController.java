package com.devjob.analysis.controller;

import com.devjob.analysis.dto.SkillDemandPage;
import com.devjob.analysis.dto.SkillDemandQuery;
import com.devjob.analysis.service.SkillDemandService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/analytics/skills")
public class SkillDemandController {
    private final SkillDemandService service;
    public SkillDemandController(SkillDemandService service) { this.service = service; }
    @GetMapping
    public SkillDemandPage get(@ModelAttribute SkillDemandQuery query) { return service.find(query); }
}
