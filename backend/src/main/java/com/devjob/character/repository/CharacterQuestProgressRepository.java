package com.devjob.character.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class CharacterQuestProgressRepository {
    private final JdbcTemplate jdbc;

    public CharacterQuestProgressRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public long resumeCount(Long userId) {
        return count("select count(*) from resume where user_id = ? and deleted_at is null", userId);
    }

    public long bookmarkCount(Long userId) {
        return count("""
                select (select count(*) from bookmark where user_id = ?)
                     + (select count(*) from personal_saved_job where user_id = ? and deleted_at is null)
                """, userId, userId);
    }

    public long applicationCount(Long userId) {
        return count("select count(*) from application where user_id = ? and deleted_at is null", userId);
    }

    public long completedLearningGoalCount(Long userId) {
        return count("select count(*) from learning_goal where user_id = ? and completed_at is not null and deleted_at is null", userId);
    }

    public long documentAnalysisCount(Long userId) {
        return count("""
                select count(*) from document_analysis a
                where exists (select 1 from resume_version v join resume r on r.id = v.resume_id
                              where v.id = a.resume_version_id and r.user_id = ? and r.deleted_at is null)
                   or exists (select 1 from cover_letter_version v join cover_letter c on c.id = v.cover_letter_id
                              where v.id = a.cover_letter_version_id and c.user_id = ? and c.deleted_at is null)
                """, userId, userId);
    }

    private long count(String sql, Object... args) {
        Long result = jdbc.queryForObject(sql, Long.class, args);
        return result == null ? 0 : result;
    }
}
