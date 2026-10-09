package com.devjob.character.repository;

import com.devjob.character.entity.CharacterReward;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CharacterRewardRepository extends JpaRepository<CharacterReward, Long> {
    List<CharacterReward> findByUserId(Long userId);
    Optional<CharacterReward> findByUserIdAndQuestId(Long userId, String questId);
    boolean existsByUserIdAndItemId(Long userId, String itemId);
}
