package com.devjob.common.error;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.json.JsonCompareMode;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = GlobalExceptionHandlerTest.ProbeController.class)
@Import({GlobalExceptionHandler.class, GlobalExceptionHandlerTest.ProbeController.class})
class GlobalExceptionHandlerTest {
    @Autowired MockMvc mvc;

    @Test
    void validBodyIsAccepted() throws Exception {
        mvc.perform(post("/probe").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"valid\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void invalidBodyUsesOnlyPublicContractFields() throws Exception {
        mvc.perform(post("/probe").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(content().json("{\"code\":\"INVALID_INPUT\",\"message\":\"입력값을 확인해 주세요.\"}", JsonCompareMode.STRICT));
    }

    @Test
    void malformedJsonAndMissingBodyAreBadRequests() throws Exception {
        for (String body : new String[]{"{", ""}) {
            mvc.perform(post("/probe").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        }
    }

    @Test
    void parameterValidationAndConversionUseBadRequest() throws Exception {
        for (String value : new String[]{"0", "abc"}) {
            mvc.perform(get("/probe").param("id", value))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        }
        mvc.perform(get("/probe")).andExpect(status().isBadRequest());
    }

    @Test
    void routingErrorsUseCommonContract() throws Exception {
        mvc.perform(get("/missing")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mvc.perform(delete("/probe")).andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));
        mvc.perform(post("/probe").contentType(MediaType.TEXT_PLAIN).content("text"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_MEDIA_TYPE"));
    }

    @Test
    void internalExceptionDetailsAreNotExposed() throws Exception {
        mvc.perform(get("/probe/failure")).andExpect(status().isInternalServerError())
                .andExpect(content().json("{\"code\":\"INTERNAL_SERVER_ERROR\",\"message\":\"서버 오류가 발생했습니다.\"}", JsonCompareMode.STRICT));
    }

    @Test
    void statusExceptionsKeepStatusAndHideReason() throws Exception {
        int[] statusCodes = {401, 403, 404, 409, 502, 503};
        String[] codes = {"UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "CONFLICT", "BAD_GATEWAY", "SERVICE_UNAVAILABLE"};
        for (int index = 0; index < statusCodes.length; index++) {
            int statusCode = statusCodes[index];
            mvc.perform(get("/probe/status").param("status", String.valueOf(statusCode)))
                    .andExpect(status().is(statusCode))
                    .andExpect(jsonPath("$.code").value(codes[index]))
                    .andExpect(jsonPath("$.message").isString())
                    .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.not("private reason")))
                    .andExpect(jsonPath("$.*").value(org.hamcrest.Matchers.hasSize(2)));
        }
    }

    @RestController
    static class ProbeController {
        @PostMapping("/probe")
        void create(@Valid @RequestBody ProbeRequest request) { }
        @GetMapping("/probe")
        void read(@RequestParam @Min(1) int id) { }
        @GetMapping("/probe/failure")
        void fail() { throw new IllegalStateException("private exception detail"); }
        @GetMapping("/probe/status")
        void status(@RequestParam int status) {
            throw new ResponseStatusException(HttpStatus.valueOf(status), "private reason");
        }
    }

    record ProbeRequest(@NotBlank String name) { }
}
