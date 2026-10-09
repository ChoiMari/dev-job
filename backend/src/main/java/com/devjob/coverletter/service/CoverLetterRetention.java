package com.devjob.coverletter.service;

import com.devjob.coverletter.repository.*;
import java.time.Duration;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CoverLetterRetention {
    private final CoverLetterRepository coverLetters;
    private final CoverLetterVersionRepository versions;
    public CoverLetterRetention(CoverLetterRepository coverLetters, CoverLetterVersionRepository versions) {
        this.coverLetters = coverLetters; this.versions = versions;
    }
    @Scheduled(cron = "0 0 3 * * *", zone = "UTC")
    @Transactional
    public void purgeExpired() {
        var cutoff = com.devjob.coverletter.entity.CoverLetter.now().minus(Duration.ofDays(30));
        while (true) {
            var ids = coverLetters.expiredIds(cutoff, PageRequest.of(0, 100));
            if (ids.isEmpty()) return;
            for (Long id : ids) {
                var locked = coverLetters.findForUpdate(id);
                if (locked.isPresent() && locked.get().getDeletedAt() != null
                        && !locked.get().getDeletedAt().isAfter(cutoff)) {
                    versions.deleteForCoverLetter(id);
                    coverLetters.delete(locked.get());
                    coverLetters.flush();
                }
            }
        }
    }

    @Configuration @EnableScheduling
    static class Scheduling { }
}
