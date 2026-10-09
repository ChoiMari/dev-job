package com.devjob.coverletter.repository;

import com.devjob.coverletter.entity.CoverLetter;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface CoverLetterRepository extends JpaRepository<CoverLetter, Long> {
    @Query("select r from CoverLetter r where r.user.id = :userId and r.deletedAt is null order by r.updatedAt desc, r.id desc")
    Page<CoverLetter> list(@Param("userId") Long userId, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from CoverLetter r where r.id = :id")
    Optional<CoverLetter> findForUpdate(@Param("id") Long id);

    @Query("select r.id from CoverLetter r where r.deletedAt <= :cutoff")
    java.util.List<Long> expiredIds(@Param("cutoff") Instant cutoff, Pageable pageable);
}
