package com.devjob.skill.repository;

import com.devjob.skill.entity.Skill;
import com.devjob.skill.entity.UserSkill;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface UserSkillRepository extends JpaRepository<UserSkill, Long> {
    @Query("select u.skill from UserSkill u where u.user.id = :userId order by u.skill.normalizedName, u.skill.id")
    List<Skill> findSkills(@Param("userId") Long userId);

    @Query("select u from UserSkill u join fetch u.skill where u.user.id = :userId order by u.skill.normalizedName, u.skill.id")
    List<UserSkill> findOwned(@Param("userId") Long userId);

    @Query("select u from UserSkill u join fetch u.skill where u.user.id = :userId and u.skill.id = :skillId")
    Optional<UserSkill> findOwned(@Param("userId") Long userId, @Param("skillId") Long skillId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update UserSkill u set u.proficiencyLevel = case when :levelPresent = true then :level else u.proficiencyLevel end, "
            + "u.experienceMonths = case when :monthsPresent = true then :months else u.experienceMonths end "
            + "where u.user.id = :userId and u.skill.id = :skillId")
    int updateExperience(@Param("userId") Long userId, @Param("skillId") Long skillId,
            @Param("levelPresent") boolean levelPresent, @Param("level") Integer level,
            @Param("monthsPresent") boolean monthsPresent, @Param("months") Integer months);

    @Modifying
    @Query(value = "insert into user_skill(user_id, skill_id, created_at) values (:userId, :skillId, current_timestamp) "
            + "on conflict (user_id, skill_id) do nothing", nativeQuery = true)
    int add(@Param("userId") Long userId, @Param("skillId") Long skillId);

    @Modifying
    @Query("delete from UserSkill u where u.user.id = :userId and u.skill.id = :skillId")
    int remove(@Param("userId") Long userId, @Param("skillId") Long skillId);
}
