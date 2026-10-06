package com.devjob.application;

import com.devjob.application.entity.ApplicationStatus;
import java.util.Set;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class ApplicationStatusTest {
    @Test void everyStatusPairMatchesTheDocumentedTransitionGraph() {
        Set<String> allowed = Set.of("INTERESTED:PLANNED", "INTERESTED:WITHDRAWN", "PLANNED:APPLIED", "PLANNED:WITHDRAWN",
                "APPLIED:DOCUMENT_PASSED", "APPLIED:REJECTED", "APPLIED:WITHDRAWN", "DOCUMENT_PASSED:INTERVIEW",
                "DOCUMENT_PASSED:REJECTED", "INTERVIEW:FINAL_PASSED", "INTERVIEW:REJECTED");
        for (var from : ApplicationStatus.values()) for (var to : ApplicationStatus.values())
            assertThat(from.canTransitionTo(to)).as("%s -> %s", from, to).isEqualTo(allowed.contains(from + ":" + to));
        for (var status : ApplicationStatus.values())
            assertThat(status.canStart()).isEqualTo(Set.of("INTERESTED", "PLANNED", "APPLIED").contains(status.name()));
    }
}
