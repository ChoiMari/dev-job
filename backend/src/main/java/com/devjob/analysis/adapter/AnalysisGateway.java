package com.devjob.analysis.adapter;

public interface AnalysisGateway {
    String analyze(String title, String description);
    default boolean available() { return true; }
}
