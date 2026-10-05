package com.devjob.project.dto;

import com.devjob.project.entity.Project;
import com.devjob.skill.dto.SkillResponse;
import java.time.LocalDate;
import java.util.List;

public record ProjectResponse(Long id, String name, String description, LocalDate startDate, LocalDate endDate,
        String role, String keyFeatures, String outcome, String projectUrl, List<SkillResponse> skills) {
    public static ProjectResponse from(Project project, List<SkillResponse> skills) {
        return new ProjectResponse(project.getId(), project.getName(), project.getDescription(), project.getStartDate(),
                project.getEndDate(), project.getRole(), project.getKeyFeatures(), project.getOutcome(), project.getProjectUrl(), skills);
    }
}
