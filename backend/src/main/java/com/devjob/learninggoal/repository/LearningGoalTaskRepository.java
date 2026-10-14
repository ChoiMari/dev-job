package com.devjob.learninggoal.repository;

import com.devjob.learninggoal.entity.LearningGoalTask;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LearningGoalTaskRepository extends JpaRepository<LearningGoalTask, Long> {
    @Query("select t from LearningGoalTask t where t.goal.id = :goalId order by t.id")
    List<LearningGoalTask> findByGoalIdOrderByIdAsc(@Param("goalId") Long goalId);
    @Query("select count(t) from LearningGoalTask t where t.goal.id = :goalId")
    long countByGoalId(@Param("goalId") Long goalId);
    @Query("select count(t) from LearningGoalTask t where t.goal.id = :goalId and t.completed = true")
    long countByGoalIdAndCompletedTrue(@Param("goalId") Long goalId);
}
