package com.devjob.project.service;

import com.devjob.project.dto.*;
import com.devjob.project.entity.*;
import com.devjob.project.repository.*;
import com.devjob.skill.entity.Skill;
import com.devjob.skill.repository.SkillAliasRepository;
import com.devjob.skill.repository.SkillRepository;
import com.devjob.skill.service.SkillName;
import com.devjob.user.repository.UserRepository;
import jakarta.persistence.criteria.Predicate;
import java.util.*;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.stream.Collectors;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ProjectService {
    private final ProjectRepository projects;
    private final ProjectSkillRepository links;
    private final SkillRepository skills;
    private final SkillAliasRepository aliases;
    private final UserRepository users;
    private final ProjectImageService images;
    public ProjectService(ProjectRepository projects, ProjectSkillRepository links, SkillRepository skills, SkillAliasRepository aliases,
            UserRepository users, ProjectImageService images) {
        this.projects = projects; this.links = links; this.skills = skills; this.aliases = aliases; this.users = users; this.images = images;
    }
    @Transactional(readOnly = true)
    public Page<ProjectResponse> list(Long userId, int page, int size, String q, ProjectType projectType,
            String status, String sort) {
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE) throw error(HttpStatus.BAD_REQUEST);
        String term = q == null ? "" : q.strip();
        if (term.length() > 100
                || (status != null && !Set.of("PLANNED", "IN_PROGRESS", "COMPLETED").contains(status))
                || !Set.of("NEWEST", "OLDEST").contains(sort)) throw error(HttpStatus.BAD_REQUEST);
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Seoul"));
        Specification<Project> criteria = (root, query, cb) -> {
            List<Predicate> conditions = new ArrayList<>();
            conditions.add(cb.equal(root.get("user").get("id"), userId));
            if (projectType != null) conditions.add(cb.equal(root.get("projectType"), projectType));
            if ("PLANNED".equals(status)) conditions.add(cb.greaterThan(root.get("startDate"), today));
            if ("IN_PROGRESS".equals(status)) conditions.add(cb.and(cb.lessThanOrEqualTo(root.get("startDate"), today),
                    cb.or(cb.isNull(root.get("endDate")), cb.greaterThanOrEqualTo(root.get("endDate"), today))));
            if ("COMPLETED".equals(status)) conditions.add(cb.lessThan(root.get("endDate"), today));
            if (!term.isEmpty()) {
                String pattern = "%" + term.toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
                var match = query.subquery(Long.class);
                var projectSkill = match.from(ProjectSkill.class);
                match.select(projectSkill.get("id")).where(cb.equal(projectSkill.get("project").get("id"), root.get("id")),
                        cb.like(cb.lower(projectSkill.get("skill").get("name")), pattern, '\\'));
                var customMatch = query.subquery(Long.class);
                var customSkill = customMatch.from(ProjectCustomSkill.class);
                customMatch.select(customSkill.get("id")).where(cb.equal(customSkill.get("project").get("id"), root.get("id")),
                        cb.like(cb.lower(customSkill.get("name")), pattern, '\\'));
                conditions.add(cb.or(cb.like(cb.lower(root.get("name")), pattern, '\\'), cb.exists(match), cb.exists(customMatch)));
            }
            return cb.and(conditions.toArray(Predicate[]::new));
        };
        Sort.Direction direction = "OLDEST".equals(sort) ? Sort.Direction.ASC : Sort.Direction.DESC;
        var result = projects.findAll(criteria, PageRequest.of(page, size, Sort.by(direction, "createdAt", "id")));
        if (result.isEmpty()) return result.map(p -> ProjectResponse.from(p, List.of()));
        var grouped = links.findForProjects(result.stream().map(Project::getId).toList()).stream()
                .collect(Collectors.groupingBy(ProjectSkill::getProjectId));
        return result.map(p -> ProjectResponse.from(p, grouped.getOrDefault(p.getId(), List.of())));
    }
    @Transactional(readOnly = true)
    public ProjectResponse get(Long userId, Long id) { return response(owned(userId, id, false)); }
    @Transactional
    public ProjectResponse create(Long userId, ProjectInput input) {
        var selected = selected(input);
        var project = new Project(users.findById(userId).orElseThrow(() -> error(HttpStatus.UNAUTHORIZED)));
        project.update(input, selected, custom(input));
        return response(projects.saveAndFlush(project));
    }
    @Transactional
    public ProjectResponse update(Long userId, Long id, ProjectInput input) {
        var project = owned(userId, id, true);
        project.update(input, selected(input), custom(input));
        projects.flush();
        return response(project);
    }
    @Transactional
    public void delete(Long userId, Long id) { var project = owned(userId, id, true); images.removeAllForProject(id); projects.delete(project); projects.flush(); }
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
    private List<ProjectInput.CustomSkillItem> custom(ProjectInput input) {
        var seen = new HashSet<String>();
        var result = new ArrayList<ProjectInput.CustomSkillItem>();
        for (var item : input.customSkills()) {
            var name = SkillName.parse(item.name());
            if (!seen.add(name.key()) || skills.findByNormalizedName(name.key()).isPresent()
                    || aliases.resolve(name.key()).isPresent()) throw error(HttpStatus.BAD_REQUEST);
            result.add(new ProjectInput.CustomSkillItem(name.display(), item.usage()));
        }
        return result;
    }
    private ProjectResponse response(Project project) {
        return ProjectResponse.from(project, project.getSkills().stream()
                .sorted(Comparator.comparing((ProjectSkill link) -> link.getSkill().getName())
                        .thenComparing(link -> link.getSkill().getId())).toList());
    }
    private ResponseStatusException error(HttpStatus status) { return new ResponseStatusException(status); }
}
