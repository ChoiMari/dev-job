package com.devjob.company.repository;

import com.devjob.company.entity.InterestedCompany;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface InterestedCompanyRepository extends JpaRepository<InterestedCompany, Long> {
    Page<InterestedCompany> findByUser_Id(Long userId, Pageable pageable);
    @Query("""
            select c from InterestedCompany c where c.user.id = :userId
              and (cast(:q as String) is null or lower(c.name) like lower(concat('%', cast(:q as String), '%'))
                   or lower(c.note) like lower(concat('%', cast(:q as String), '%'))
                   or exists (select 1 from InterestedCompany tagged join tagged.tags searchTag
                       where tagged.id = c.id and lower(searchTag) like lower(concat('%', cast(:q as String), '%'))))
              and (:industry is null or c.industry = :industry)
              and (:companySize is null or c.companySize = :companySize)
              and (cast(:region as String) is null or lower(c.region) like lower(concat(cast(:region as String), '%')))
              and (:interestLevel is null or c.interestLevel = :interestLevel)
              and (:favorite is null or c.favorite = :favorite)
              and (:tag is null or :tag member of c.tags)
            """)
    Page<InterestedCompany> search(@Param("userId") Long userId, @Param("q") String q,
            @Param("industry") String industry, @Param("companySize") com.devjob.company.dto.CompanySize companySize,
            @Param("region") String region, @Param("interestLevel") com.devjob.company.dto.InterestLevel interestLevel,
            @Param("favorite") Boolean favorite, @Param("tag") String tag, Pageable pageable);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from InterestedCompany c where c.id = :id")
    Optional<InterestedCompany> findForUpdate(@Param("id") Long id);
}
