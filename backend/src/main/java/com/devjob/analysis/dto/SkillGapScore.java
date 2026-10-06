package com.devjob.analysis.dto;

public final class SkillGapScore {
    private SkillGapScore() { }

    public static double calculate(long requiredJobCount, long preferredJobCount, long analyzedJobCount) {
        return 100.0 * (requiredJobCount + 0.5 * preferredJobCount) / analyzedJobCount;
    }
}
