package com.devjob.common.error;

import jakarta.servlet.RequestDispatcher;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import static org.assertj.core.api.Assertions.assertThat;

class ApiErrorControllerTest {
    private final ApiErrorController controller = new ApiErrorController();

    @Test
    void servletDispatchDoesNotExposeInternalAttributes() {
        var request = new MockHttpServletRequest();
        request.setAttribute(RequestDispatcher.ERROR_STATUS_CODE, 404);
        request.setAttribute(RequestDispatcher.ERROR_MESSAGE, "private detail");
        var response = controller.error(request);
        assertThat(response.getStatusCode().value()).isEqualTo(404);
        assertThat(response.getBody()).isEqualTo(new ApiError("NOT_FOUND", "요청한 대상을 찾을 수 없습니다."));
    }

    @Test
    void directErrorRequestDefaultsToServerError() {
        assertThat(controller.error(new MockHttpServletRequest()).getStatusCode().value()).isEqualTo(500);
    }
}
