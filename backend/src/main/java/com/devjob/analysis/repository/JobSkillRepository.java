package com.devjob.analysis.repository;

import com.devjob.analysis.entity.JobSkill;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface JobSkillRepository extends JpaRepository<JobSkill, Long> {
    @Query("select js from JobSkill js join fetch js.skill where js.job.id = :jobId order by js.id")
    List<JobSkill> findForJob(Long jobId);
    @Modifying
    @Query("delete from JobSkill js where js.job.id = :jobId")
    void deleteForJob(Long jobId);
}
