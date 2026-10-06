package com.devjob.application.repository;

import com.devjob.application.entity.*;
import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface ApplicationRepository extends JpaRepository<Application, Long> {
    boolean existsByUserIdAndJobId(Long userId, Long jobId);
    @EntityGraph(attributePaths = {"job", "job.company", "job.jobSource"})
    Page<Application> findByUserId(Long userId, Pageable pageable);
    @EntityGraph(attributePaths = {"job", "job.company", "job.jobSource"})
    Page<Application> findByUserIdAndCurrentStatus(Long userId, ApplicationStatus status, Pageable pageable);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Application a where a.id = :id")
    Optional<Application> findForUpdate(@Param("id") Long id);
    List<Application> findByUserIdAndJobIdIn(Long userId, Collection<Long> jobIds);
}
