package com.devjob.job.repository;

import com.devjob.job.adapter.RecruitmentDetails;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JobRecruitmentDetailRepository {
    private final JdbcTemplate jdbc;

    public JobRecruitmentDetailRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public void replace(long jobId, RecruitmentDetails details) {
        jdbc.update("delete from job_recruitment_step where job_posting_id = ?", jobId);
        jdbc.update("delete from job_recruitment_attachment where job_posting_id = ?", jobId);
        for (var step : details.steps()) {
            jdbc.update("insert into job_recruitment_step (job_posting_id, external_id, sort_order, title, "
                    + "openings, applicants, competition_rate, event_date) values (?, ?, ?, ?, ?, ?, ?, ?)",
                    jobId, step.externalId(), step.sortOrder(), step.title(), step.openings(),
                    step.applicants(), step.competitionRate(), step.eventDate());
        }
        for (var attachment : details.attachments()) {
            jdbc.update("insert into job_recruitment_attachment (job_posting_id, external_id, sort_order, name, "
                    + "file_type, url) values (?, ?, ?, ?, ?, ?)",
                    jobId, attachment.externalId(), attachment.sortOrder(), attachment.name(),
                    attachment.type(), attachment.url());
        }
    }

    public RecruitmentDetails find(long jobId) {
        List<RecruitmentDetails.Step> steps = jdbc.query(
                "select external_id, sort_order, title, openings, applicants, competition_rate, event_date "
                        + "from job_recruitment_step where job_posting_id = ? order by sort_order, external_id",
                (rs, row) -> new RecruitmentDetails.Step(rs.getLong(1), rs.getInt(2), rs.getString(3),
                        (Integer) rs.getObject(4), (Integer) rs.getObject(5), rs.getString(6), rs.getString(7)), jobId);
        List<RecruitmentDetails.Attachment> attachments = jdbc.query(
                "select external_id, sort_order, name, file_type, url from job_recruitment_attachment "
                        + "where job_posting_id = ? order by sort_order, external_id",
                (rs, row) -> new RecruitmentDetails.Attachment(rs.getLong(1), rs.getInt(2),
                        rs.getString(3), rs.getString(4), rs.getString(5)), jobId);
        return new RecruitmentDetails(steps, attachments);
    }
}
