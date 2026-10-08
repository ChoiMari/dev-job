package com.devjob.resume.service;

import com.devjob.resume.repository.*;
import java.time.Duration;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ResumeRetention {
    private final ResumeRepository resumes;
    private final ResumeVersionRepository versions;
    public ResumeRetention(ResumeRepository resumes, ResumeVersionRepository versions) {
        this.resumes = resumes; this.versions = versions;
    }
    @Scheduled(cron = "0 0 3 * * *", zone = "UTC")
    @Transactional
    public void purgeExpired() {
        var cutoff = com.devjob.resume.entity.Resume.now().minus(Duration.ofDays(30));
        while (true) {
            var ids = resumes.expiredIds(cutoff, PageRequest.of(0, 100));
            if (ids.isEmpty()) return;
            for (Long id : ids) {
                var locked = resumes.findForUpdate(id);
                if (locked.isPresent() && locked.get().getDeletedAt() != null
                        && !locked.get().getDeletedAt().isAfter(cutoff)) {
                    versions.deleteForResume(id);
                    resumes.delete(locked.get());
                    resumes.flush();
                }
            }
        }
    }

    @Configuration @EnableScheduling
    static class Scheduling { }
}
