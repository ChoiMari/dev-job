package com.devjob.documentanalysis.adapter;

import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class OpenAiDocumentAnalysisGateway implements DocumentAnalysisGateway {
    private final ChatModel model;
    private final String key;
    public OpenAiDocumentAnalysisGateway(ChatModel model, @Value("${OPENAI_API_KEY:}") String key) {
        this.model = model; this.key = key;
    }
    @Override public boolean available() { return !key.isBlank(); }
    @Override public String analyze(String documentType, String redactedContent) {
        if (!available()) throw new IllegalStateException("AI provider unavailable");
        String prompt = "다음 " + documentType + " 텍스트만 근거로 분석하세요. 개인정보를 출력하지 마세요. "
                + "점수, 합격 가능성, 추측을 작성하지 마세요. JSON 객체 하나만 출력하세요. "
                + "형식: {\"skills\":[\"Java\"],\"strengths\":[\"구체적인 강점\"],\"improvements\":[\"구체적인 개선 제안\"]}. "
                + "skills 최대 20개, strengths와 improvements 각각 최대 5개, 각 문장 200자 이내. 없으면 빈 배열.\n\n"
                + redactedContent;
        var response = model.call(new Prompt(prompt));
        if (response == null || response.getResult() == null || response.getResult().getOutput() == null)
            throw new IllegalStateException("AI response unavailable");
        return response.getResult().getOutput().getText();
    }
}
