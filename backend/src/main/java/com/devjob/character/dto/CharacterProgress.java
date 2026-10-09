package com.devjob.character.dto;

public record CharacterProgress(int level, long totalExp, long levelExp, long nextLevelExp) {
    public static CharacterProgress from(long totalExp) {
        int level = 1;
        long threshold = 100;
        long remaining = totalExp;
        while (remaining >= threshold && level < Integer.MAX_VALUE) {
            remaining -= threshold;
            level++;
            threshold += 50;
        }
        return new CharacterProgress(level, totalExp, remaining, threshold);
    }
}
