package com.devjob.bookmark.repository;

import com.devjob.bookmark.entity.Bookmark;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface BookmarkRepository extends JpaRepository<Bookmark, Long> {
    @EntityGraph(attributePaths = {"job", "job.company", "job.jobSource"})
    Page<Bookmark> findByUserId(Long userId, Pageable pageable);

    @EntityGraph(attributePaths = {"job", "job.company", "job.jobSource"})
    Optional<Bookmark> findByUserIdAndJobId(Long userId, Long jobId);

    boolean existsByUserIdAndJobId(Long userId, Long jobId);

    @Query("select b.job.id from Bookmark b where b.user.id = :userId and b.job.id in :jobIds")
    List<Long> findSavedJobIds(@Param("userId") Long userId, @Param("jobIds") Collection<Long> jobIds);

    // A conflicting concurrent insert returns 0 without aborting the transaction.
    @Modifying
    @Query(value = "insert into bookmark(user_id, job_posting_id, created_at) values (:userId, :jobId, current_timestamp) "
            + "on conflict (user_id, job_posting_id) do nothing", nativeQuery = true)
    int add(@Param("userId") Long userId, @Param("jobId") Long jobId);

    @Modifying
    @Query("delete from Bookmark b where b.user.id = :userId and b.job.id = :jobId")
    int remove(@Param("userId") Long userId, @Param("jobId") Long jobId);
}
