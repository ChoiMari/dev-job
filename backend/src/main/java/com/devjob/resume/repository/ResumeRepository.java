package com.devjob.resume.repository;

import com.devjob.resume.entity.Resume;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface ResumeRepository extends JpaRepository<Resume, Long> {
    @Query("select r from Resume r where r.user.id = :userId and r.deletedAt is null order by r.updatedAt desc, r.id desc")
    Page<Resume> list(@Param("userId") Long userId, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Resume r where r.id = :id")
    Optional<Resume> findForUpdate(@Param("id") Long id);

    @Query("select r.id from Resume r where r.deletedAt <= :cutoff")
    java.util.List<Long> expiredIds(@Param("cutoff") Instant cutoff, Pageable pageable);
}
