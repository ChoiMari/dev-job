package com.devjob.interview.repository;

import com.devjob.interview.entity.InterviewSchedule;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface InterviewScheduleRepository extends JpaRepository<InterviewSchedule, Long> {
    @Query("select i from InterviewSchedule i where i.user.id = :userId")
    Page<InterviewSchedule> findByUserId(@Param("userId") Long userId, Pageable pageable);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from InterviewSchedule i where i.id = :id")
    Optional<InterviewSchedule> findForUpdate(@Param("id") Long id);
}
