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
    boolean existsByUserIdAndJobIdAndDeletedAtIsNull(Long userId, Long jobId);
    boolean existsByUserIdAndPersonalSavedJobIdAndDeletedAtIsNull(Long userId, Long personalSavedJobId);
    @EntityGraph(attributePaths = {"job", "job.company", "job.jobSource"})
    Optional<Application> findByUserIdAndJobIdAndDeletedAtIsNull(Long userId, Long jobId);
    @EntityGraph(attributePaths = {"job", "job.company", "job.jobSource", "personalSavedJob"})
    Page<Application> findByUserIdAndDeletedAtIsNull(Long userId, Pageable pageable);
    @EntityGraph(attributePaths = {"job", "job.company", "job.jobSource", "personalSavedJob"})
    Page<Application> findByUserIdAndCurrentStatusAndDeletedAtIsNull(Long userId, ApplicationStatus status, Pageable pageable);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Application a where a.id = :id")
    Optional<Application> findForUpdate(@Param("id") Long id);
    List<Application> findByUserIdAndJobIdInAndDeletedAtIsNull(Long userId, Collection<Long> jobIds);
    @Query("select a.currentStatus, count(a) from Application a where a.user.id = :userId and a.deletedAt is null group by a.currentStatus")
    List<Object[]> countByStatus(@Param("userId") Long userId);
    @EntityGraph(attributePaths = {"job", "personalSavedJob"})
    @Query("select a from Application a where a.user.id = :userId and a.deletedAt is null and a.currentStatus in :statuses "
            + "order by case when a.nextScheduleAt is null then 1 else 0 end, a.nextScheduleAt, a.id")
    List<Application> findNextActions(@Param("userId") Long userId,
            @Param("statuses") Collection<ApplicationStatus> statuses, Pageable pageable);
}
