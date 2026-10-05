package com.devjob.project.repository;

import com.devjob.project.entity.ProjectSkill;
import java.util.List;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface ProjectSkillRepository extends JpaRepository<ProjectSkill, Long> {
    @Query("select ps from ProjectSkill ps join fetch ps.skill where ps.project.id in :ids order by ps.skill.normalizedName, ps.skill.id")
    List<ProjectSkill> findForProjects(@Param("ids") List<Long> ids);
}
