package com.devjob.skill.repository;

import com.devjob.skill.entity.Skill;
import com.devjob.skill.entity.SkillAlias;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface SkillAliasRepository extends JpaRepository<SkillAlias, Long> {
    @Query("select a.skill from SkillAlias a where a.normalizedName = :key")
    Optional<Skill> resolve(@Param("key") String key);

    @Modifying
    @Query(value = "insert into skill_alias(skill_id, alias_name, normalized_name) values (:id, :name, :key) "
            + "on conflict (normalized_name) do nothing", nativeQuery = true)
    int insertIfAbsent(@Param("id") Long id, @Param("name") String name, @Param("key") String key);
}
