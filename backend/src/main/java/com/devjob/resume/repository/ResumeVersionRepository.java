package com.devjob.resume.repository;

import com.devjob.resume.entity.ResumeVersion;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface ResumeVersionRepository extends JpaRepository<ResumeVersion, Long> {
    @Query("select v from ResumeVersion v where v.resume.id = :resumeId order by v.versionNumber desc")
    List<ResumeVersion> list(@Param("resumeId") Long resumeId);
    @Query("select v from ResumeVersion v where v.resume.id = :resumeId order by v.versionNumber desc limit 1")
    Optional<ResumeVersion> latest(@Param("resumeId") Long resumeId);
    @Query("select v from ResumeVersion v where v.id = :id and v.resume.id = :resumeId")
    Optional<ResumeVersion> owned(@Param("id") Long id, @Param("resumeId") Long resumeId);
    @Modifying
    @Query("delete from ResumeVersion v where v.resume.id = :resumeId")
    void deleteForResume(@Param("resumeId") Long resumeId);
}
