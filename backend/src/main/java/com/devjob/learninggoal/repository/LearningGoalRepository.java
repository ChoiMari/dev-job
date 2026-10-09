package com.devjob.learninggoal.repository;

import com.devjob.learninggoal.entity.LearningGoal;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface LearningGoalRepository extends JpaRepository<LearningGoal, Long> {
    @Query("select g from LearningGoal g where g.user.id = :userId and g.deletedAt is null "
            + "and (:completed is null or (:completed = true and g.completedAt is not null) "
            + "or (:completed = false and g.completedAt is null))")
    Page<LearningGoal> list(@Param("userId") Long userId, @Param("completed") Boolean completed, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select g from LearningGoal g where g.id = :id")
    Optional<LearningGoal> findForUpdate(@Param("id") Long id);
}
