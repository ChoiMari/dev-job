package com.devjob.skill.repository;

import com.devjob.skill.entity.Skill;
import com.devjob.skill.entity.UserSkill;
import java.util.List;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface UserSkillRepository extends JpaRepository<UserSkill, Long> {
    @Query("select u.skill from UserSkill u where u.user.id = :userId order by u.skill.normalizedName, u.skill.id")
    List<Skill> findSkills(@Param("userId") Long userId);

    @Modifying
    @Query(value = "insert into user_skill(user_id, skill_id, created_at) values (:userId, :skillId, current_timestamp) "
            + "on conflict (user_id, skill_id) do nothing", nativeQuery = true)
    int add(@Param("userId") Long userId, @Param("skillId") Long skillId);

    @Modifying
    @Query("delete from UserSkill u where u.user.id = :userId and u.skill.id = :skillId")
    int remove(@Param("userId") Long userId, @Param("skillId") Long skillId);
}
