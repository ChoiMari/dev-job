package com.devjob.job.service;

import java.util.Map;

/** Search categories over the career text supplied by external job sources. */
public final class JobCareerBands {
    public static final Map<String, String> PATTERNS = Map.of(
            "NEW", "신입",
            "ANY", "무관",
            "UP_TO_1", "1[[:space:]]*년[[:space:]]*(이하|미만)|0[[:space:]]*[~-][[:space:]]*1[[:space:]]*년",
            "YEARS_1_3", "1[[:space:]]*[~-][[:space:]]*3[[:space:]]*년|1[[:space:]]*년[[:space:]]*이상|2[[:space:]]*년|3[[:space:]]*년[[:space:]]*이하",
            "YEARS_3_5", "3[[:space:]]*[~-][[:space:]]*5[[:space:]]*년|[34][[:space:]]*년([[:space:]]*이상)?|5[[:space:]]*년[[:space:]]*이하",
            "OVER_5", "5[[:space:]]*년[[:space:]]*이상|([6-9]|[1-9][0-9]+)[[:space:]]*년");

    private JobCareerBands() { }
}
