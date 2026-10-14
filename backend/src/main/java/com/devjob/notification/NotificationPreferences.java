package com.devjob.notification;

public record NotificationPreferences(boolean interviewReminder, boolean todoReminder,
        boolean newJob, boolean aiJobRecommendation, boolean savedJobUpdate,
        boolean documentAnalysis, boolean matchAnalysis, boolean semanticRecommendation,
        boolean learningGoalReminder, boolean characterActivity, boolean serviceNotice) { }
