package com.devjob.savedjob.repository;

import com.devjob.savedjob.entity.PersonalSavedJob;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PersonalSavedJobRepository extends JpaRepository<PersonalSavedJob, Long> {
    Optional<PersonalSavedJob> findByIdAndUserIdAndDeletedAtIsNull(Long id, Long userId);
    boolean existsByUserIdAndUrlAndDeletedAtIsNull(Long userId, String url);
    boolean existsByUserIdAndUrlAndIdNotAndDeletedAtIsNull(Long userId, String url, Long id);
    long countByUserIdAndDeletedAtIsNull(Long userId);
}
