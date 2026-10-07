package com.devjob.job.adapter;

import java.util.List;

/** Provider detail metadata. File bytes are never collected. */
public record RecruitmentDetails(List<Step> steps, List<Attachment> attachments) {
    public RecruitmentDetails {
        steps = List.copyOf(steps);
        attachments = List.copyOf(attachments);
    }
    public record Step(long externalId, int sortOrder, String title, Integer openings,
                       Integer applicants, String competitionRate, String eventDate) { }
    public record Attachment(long externalId, int sortOrder, String name, String type, String url) { }
}
