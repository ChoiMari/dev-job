package com.devjob.application;

import com.devjob.application.entity.ApplicationStatus;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class ApplicationStatusTest {
    @Test void everyDifferentStatusExceptInterestedIsReachable() {
        for (var from : ApplicationStatus.values()) for (var to : ApplicationStatus.values())
            assertThat(from.canTransitionTo(to)).as("%s -> %s", from, to)
                    .isEqualTo(from != to && to != ApplicationStatus.INTERESTED);
        for (var from : ApplicationStatus.values())
            assertThat(from.canTransitionTo(null)).isFalse();
        for (var status : ApplicationStatus.values())
            assertThat(status.canStart()).isTrue();
    }
}
