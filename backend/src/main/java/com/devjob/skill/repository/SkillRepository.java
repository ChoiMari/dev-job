package com.devjob.skill.repository;

import com.devjob.skill.entity.Skill;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface SkillRepository extends JpaRepository<Skill, Long> {
    Optional<Skill> findByNormalizedName(String normalizedName);

    @Query("select s from Skill s where :q = '' or locate(:q, s.normalizedName) > 0 "
            + "or exists (select a.id from SkillAlias a where a.skill = s and locate(:q, a.normalizedName) > 0)")
    Page<Skill> search(@Param("q") String query, Pageable pageable);

    @Modifying
    @Query(value = "insert into skill(name, normalized_name) values (:name, :key) "
            + "on conflict (normalized_name) do nothing", nativeQuery = true)
    int insertIfAbsent(@Param("name") String name, @Param("key") String key);
}
