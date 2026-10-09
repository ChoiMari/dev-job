package com.devjob.documentanalysis.repository;

import com.devjob.documentanalysis.entity.DocumentAnalysis;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface DocumentAnalysisRepository extends JpaRepository<DocumentAnalysis, Long> {
    Optional<DocumentAnalysis> findByResumeVersionId(Long id);
    Optional<DocumentAnalysis> findByCoverLetterVersionId(Long id);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from DocumentAnalysis a where a.id = :id")
    Optional<DocumentAnalysis> findForUpdate(@Param("id") Long id);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from DocumentAnalysis a where a.resumeVersionId = :id")
    Optional<DocumentAnalysis> findResumeForUpdate(@Param("id") Long id);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from DocumentAnalysis a where a.coverLetterVersionId = :id")
    Optional<DocumentAnalysis> findCoverForUpdate(@Param("id") Long id);

    @Modifying @Query(value = "DELETE FROM document_analysis WHERE resume_version_id IN "
            + "(SELECT id FROM resume_version WHERE resume_id = :documentId)", nativeQuery = true)
    void deleteForResume(@Param("documentId") Long documentId);

    @Modifying @Query(value = "DELETE FROM document_analysis WHERE cover_letter_version_id IN "
            + "(SELECT id FROM cover_letter_version WHERE cover_letter_id = :documentId)", nativeQuery = true)
    void deleteForCoverLetter(@Param("documentId") Long documentId);
}
