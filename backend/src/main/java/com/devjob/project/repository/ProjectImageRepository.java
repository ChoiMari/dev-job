package com.devjob.project.repository;

import com.devjob.project.entity.ProjectImage;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectImageRepository extends JpaRepository<ProjectImage, Long> {
    List<ProjectImage> findByProject_IdOrderByIdAsc(Long projectId);
    List<ProjectImage> findByProject_User_Id(Long userId);
    long countByProject_IdAndKind(Long projectId, ProjectImage.Kind kind);
}
