package com.devjob.project.dto;

import com.devjob.project.entity.Project;
import com.devjob.project.entity.ProjectType;
import com.devjob.project.entity.ProjectSkill;
import com.devjob.skill.dto.SkillResponse;
import java.time.LocalDate;
import java.util.List;

public record ProjectResponse(Long id, String name, ProjectType projectType, String description, LocalDate startDate, LocalDate endDate,
        String role, String keyFeatures, String outcome, String projectUrl, List<SkillResponse> skills,
        String summary, String category, Integer teamSize, String problemSolving, List<String> featureItems,
        List<String> achievementItems, String demoUrl, String githubUrl, String presentationUrl,
        Integer contributionPercent, String responsibilities, String troubleshooting, List<String> metricItems,
        List<SkillUsage> skillUsages, List<ProjectInput.ContributionItem> contributionItems,
        List<String> troubleshootingItems, List<ProjectInput.CustomSkillItem> customSkills) {
    public record SkillUsage(Long skillId, String usage) { }
    public static ProjectResponse from(Project project, List<ProjectSkill> links) {
        return new ProjectResponse(project.getId(), project.getName(), project.getProjectType(), project.getDescription(), project.getStartDate(),
                project.getEndDate(), project.getRole(), project.getKeyFeatures(), project.getOutcome(), project.getProjectUrl(),
                links.stream().map(link -> SkillResponse.from(link.getSkill())).toList(),
                project.getSummary(), project.getCategory(), project.getTeamSize(), project.getProblemSolving(),
                project.getFeatureItems(), project.getAchievementItems(), project.getDemoUrl(), project.getGithubUrl(),
                project.getPresentationUrl(), project.getContributionPercent(), project.getResponsibilities(),
                project.getTroubleshooting(), project.getMetricItems(),
                links.stream().filter(link -> link.getUsageNote() != null)
                        .map(link -> new SkillUsage(link.getSkill().getId(), link.getUsageNote())).toList(),
                project.getContributionItems(), project.getTroubleshootingItems(),
                project.getCustomSkills().stream().map(skill -> new ProjectInput.CustomSkillItem(skill.getName(), skill.getUsageNote())).toList());
    }
}
