package com.devjob.analysis.adapter;

import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class OpenAiAnalysisGateway implements AnalysisGateway {
    private final ChatModel model;
    private final String key;
    public OpenAiAnalysisGateway(ChatModel model, @Value("${OPENAI_API_KEY:}") String key) {
        this.model = model; this.key = key;
    }
    @Override public String analyze(String title, String description) {
        if (key.isBlank()) throw new IllegalStateException("AI provider unavailable");
        String source = ("제목: " + title + "\n공고 본문:\n" + (description == null ? "" : description));
        if (source.length() > 12000) source = source.substring(0, 12000);
        String instruction = "채용공고에서 명시된 개발 기술만 추출하세요. 추측하거나 원문에 없는 기술을 만들지 마세요. "
                + "필수/핵심 기술은 REQUIRED, 우대 기술은 PREFERRED로 분류하세요. "
                + "JSON 객체 하나만 반환하세요. 형식: {\"skills\":[{\"name\":\"Java\",\"requirementType\":\"REQUIRED\"}]}. "
                + "기술이 없으면 빈 배열을 반환하세요. 기술은 최대 40개입니다.\n\n" + source;
        var response = model.call(new Prompt(instruction));
        if (response == null || response.getResult() == null || response.getResult().getOutput() == null)
            throw new IllegalStateException("AI response unavailable");
        return response.getResult().getOutput().getText();
    }
}
