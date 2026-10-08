package com.devjob.company.repository;

import com.devjob.company.entity.InterestedCompany;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface InterestedCompanyRepository extends JpaRepository<InterestedCompany, Long> {
    Page<InterestedCompany> findByUser_Id(Long userId, Pageable pageable);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from InterestedCompany c where c.id = :id")
    Optional<InterestedCompany> findForUpdate(@Param("id") Long id);
}
