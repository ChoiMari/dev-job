package com.devjob.job.repository;

import com.devjob.job.entity.JobSource;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface JobSourceRepository extends JpaRepository<JobSource, Long> {
    Optional<JobSource> findByCode(String code);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select source from JobSource source where source.code = :code")
    Optional<JobSource> findByCodeForUpdate(@Param("code") String code);
}
