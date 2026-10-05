package com.devjob.project.service;

import com.devjob.project.dto.*;
import com.devjob.project.entity.*;
import com.devjob.project.repository.*;
import com.devjob.skill.dto.SkillResponse;
import com.devjob.skill.entity.Skill;
import com.devjob.skill.repository.SkillRepository;
import com.devjob.user.repository.UserRepository;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ProjectService {
    private final ProjectRepository projects;
    private final ProjectSkillRepository links;
    private final SkillRepository skills;
    private final UserRepository users;
    public ProjectService(ProjectRepository projects, ProjectSkillRepository links, SkillRepository skills, UserRepository users) {
        this.projects = projects; this.links = links; this.skills = skills; this.users = users;
    }
    @Transactional(readOnly = true)
    public Page<ProjectResponse> list(Long userId, int page, int size) {
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE) throw error(HttpStatus.BAD_REQUEST);
        var result = projects.findByUser_Id(userId, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt", "id")));
        if (result.isEmpty()) return result.map(p -> ProjectResponse.from(p, List.of()));
        var grouped = links.findForProjects(result.stream().map(Project::getId).toList()).stream()
                .collect(Collectors.groupingBy(ProjectSkill::getProjectId,
                        Collectors.mapping(link -> SkillResponse.from(link.getSkill()), Collectors.toList())));
        return result.map(p -> ProjectResponse.from(p, grouped.getOrDefault(p.getId(), List.of())));
    }
    @Transactional(readOnly = true)
    public ProjectResponse get(Long userId, Long id) { return response(owned(userId, id, false)); }
    @Transactional
    public ProjectResponse create(Long userId, ProjectInput input) {
        var selected = selected(input);
        var project = new Project(users.findById(userId).orElseThrow(() -> error(HttpStatus.UNAUTHORIZED)));
        project.update(input, selected);
        return response(projects.saveAndFlush(project));
    }
    @Transactional
    public ProjectResponse update(Long userId, Long id, ProjectInput input) {
        var project = owned(userId, id, true);
        project.update(input, selected(input));
        projects.flush();
        return response(project);
    }
    @Transactional
    public void delete(Long userId, Long id) { projects.delete(owned(userId, id, true)); projects.flush(); }
    private Project owned(Long userId, Long id, boolean lock) {
        if (id <= 0) throw error(HttpStatus.BAD_REQUEST);
        var project = (lock ? projects.findForUpdate(id) : projects.findById(id)).orElseThrow(() -> error(HttpStatus.NOT_FOUND));
        if (!project.getUserId().equals(userId)) throw error(HttpStatus.FORBIDDEN);
        return project;
    }
    private List<Skill> selected(ProjectInput input) {
        var ids = new LinkedHashSet<>(input.skillIds());
        var selected = skills.findAllById(ids);
        if (selected.size() != ids.size()) throw error(HttpStatus.NOT_FOUND);
        return selected;
    }
    private ProjectResponse response(Project project) {
        return ProjectResponse.from(project, project.getSkills().stream().map(link -> SkillResponse.from(link.getSkill()))
                .sorted(Comparator.comparing(SkillResponse::name).thenComparing(SkillResponse::id)).toList());
    }
    private ResponseStatusException error(HttpStatus status) { return new ResponseStatusException(status); }
}
