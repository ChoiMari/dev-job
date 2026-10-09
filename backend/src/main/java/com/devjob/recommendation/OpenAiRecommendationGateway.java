package com.devjob.recommendation;

import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class OpenAiRecommendationGateway implements RecommendationGateway {
    private final ChatModel model;
    private final String key;
    public OpenAiRecommendationGateway(ChatModel model, @Value("${OPENAI_API_KEY:}") String key) {
        this.model = model; this.key = key;
    }
    @Override public boolean available() { return !key.isBlank(); }
    @Override public String compare(String prompt) {
        if (!available()) throw new IllegalStateException("AI provider unavailable");
        var response = model.call(new Prompt(prompt, OpenAiChatOptions.builder().maxCompletionTokens(6000).build()));
        if (response == null || response.getResult() == null || response.getResult().getOutput() == null)
            throw new IllegalStateException("AI response unavailable");
        return response.getResult().getOutput().getText();
    }
}
