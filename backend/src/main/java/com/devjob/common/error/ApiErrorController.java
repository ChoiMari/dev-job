package com.devjob.common.error;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Keeps servlet error dispatches on the same JSON contract as MVC exceptions. */
@RestController
public class ApiErrorController implements ErrorController {
    @RequestMapping("${server.error.path:${error.path:/error}}")
    public ResponseEntity<ApiError> error(HttpServletRequest request) {
        Object attribute = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
        int status = attribute instanceof Integer value && value >= 400 && value <= 599 ? value : 500;
        return ResponseEntity.status(status).body(GlobalExceptionHandler.errorFor(status));
    }
}
