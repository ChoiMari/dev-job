package com.devjob.job.service;

import com.devjob.analysis.entity.AIAnalysis;
import com.devjob.analysis.entity.JobSkill;
import com.devjob.analysis.repository.AIAnalysisRepository;
import com.devjob.analysis.repository.JobSkillRepository;
import com.devjob.job.dto.JobMatch;
import com.devjob.job.repository.JobPostingRepository;
import com.devjob.project.repository.ProjectSkillRepository;
import com.devjob.skill.dto.SkillResponse;
import com.devjob.skill.repository.UserSkillRepository;
import com.devjob.skill.service.AccountSkillService;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class JobMatchService {
    private final JobPostingRepository jobs;
    private final AIAnalysisRepository analyses;
    private final JobSkillRepository jobSkills;
    private final UserSkillRepository userSkills;
    private final ProjectSkillRepository projectSkills;
    private final AccountSkillService accountSkills;

    public JobMatchService(JobPostingRepository jobs, AIAnalysisRepository analyses, JobSkillRepository jobSkills,
            UserSkillRepository userSkills, ProjectSkillRepository projectSkills, AccountSkillService accountSkills) {
        this.jobs = jobs; this.analyses = analyses; this.jobSkills = jobSkills;
        this.userSkills = userSkills; this.projectSkills = projectSkills; this.accountSkills = accountSkills;
    }

    public JobMatch match(Long userId, long jobId) {
        if (jobId < 1) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        if (!jobs.existsById(jobId)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        var analysis = analyses.findByJobId(jobId).orElse(null);
        if (analysis == null || analysis.getStatus() != AIAnalysis.Status.COMPLETED)
            throw new ResponseStatusException(HttpStatus.CONFLICT);
        var requirements = jobSkills.findForJob(jobId);
        if (requirements.isEmpty()) return JobMatch.unavailable("NO_JOB_SKILLS");
        Set<Long> owned = new HashSet<>();
        userSkills.findSkills(userId).forEach(skill -> owned.add(skill.getId()));
        projectSkills.findSkillIdsForUser(userId).forEach(owned::add);
        var customKeys = accountSkills.customKeys(userId);
        if (owned.isEmpty() && customKeys.isEmpty()) return JobMatch.unavailable("USER_SKILLS_EMPTY");
        var requiredMatched = new ArrayList<SkillResponse>();
        var requiredMissing = new ArrayList<SkillResponse>();
        var preferredMatched = new ArrayList<SkillResponse>();
        var preferredMissing = new ArrayList<SkillResponse>();
        for (var requirement : requirements) {
            boolean has = owned.contains(requirement.getSkill().getId())
                    || customKeys.contains(requirement.getSkill().getNormalizedName());
            var target = requirement.getRequirementType() == JobSkill.RequirementType.REQUIRED
                    ? (has ? requiredMatched : requiredMissing)
                    : (has ? preferredMatched : preferredMissing);
            target.add(SkillResponse.from(requirement.getSkill()));
        }
        int matched = requiredMatched.size() + preferredMatched.size();
        int total = requirements.size();
        return new JobMatch(true,
                new JobMatch.SkillGroup(requiredMatched, requiredMissing, requiredMatched.size() + requiredMissing.size()),
                new JobMatch.SkillGroup(preferredMatched, preferredMissing, preferredMatched.size() + preferredMissing.size()),
                (int) Math.round(100.0 * matched / total), null);
    }
}
