package com.devjob.recommendation;

public interface RecommendationGateway {
    boolean available();
    String compare(String prompt);
}
