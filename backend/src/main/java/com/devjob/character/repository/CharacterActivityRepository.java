package com.devjob.character.repository;

import com.devjob.character.entity.CharacterActivity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CharacterActivityRepository extends JpaRepository<CharacterActivity, Long> {
    boolean existsByUserIdAndActivityTypeAndActivityId(Long userId, String activityType, Long activityId);
    Page<CharacterActivity> findByUserIdOrderByEarnedAtDescIdDesc(Long userId, Pageable pageable);
    long countByUserIdAndActivityType(Long userId, String activityType);
    @Query("select coalesce(sum(a.expAmount), 0) from CharacterActivity a where a.user.id = :userId")
    long totalExp(@Param("userId") Long userId);
}
