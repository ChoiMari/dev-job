package com.devjob.coverletter.repository;

import com.devjob.coverletter.entity.CoverLetterVersion;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface CoverLetterVersionRepository extends JpaRepository<CoverLetterVersion, Long> {
    @Query("select v from CoverLetterVersion v where v.coverLetter.id = :coverLetterId order by v.versionNumber desc")
    List<CoverLetterVersion> list(@Param("coverLetterId") Long coverLetterId);
    @Query("select v from CoverLetterVersion v where v.coverLetter.id = :coverLetterId order by v.versionNumber desc limit 1")
    Optional<CoverLetterVersion> latest(@Param("coverLetterId") Long coverLetterId);
    @Query("select v from CoverLetterVersion v where v.id = :id and v.coverLetter.id = :coverLetterId")
    Optional<CoverLetterVersion> owned(@Param("id") Long id, @Param("coverLetterId") Long coverLetterId);
    @Modifying
    @Query("delete from CoverLetterVersion v where v.coverLetter.id = :coverLetterId")
    void deleteForCoverLetter(@Param("coverLetterId") Long coverLetterId);
}
