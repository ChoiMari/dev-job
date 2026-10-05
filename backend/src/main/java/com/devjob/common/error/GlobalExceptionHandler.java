package com.devjob.common.error;

import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @Override
    protected ResponseEntity<Object> handleExceptionInternal(Exception exception, Object body,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        return new ResponseEntity<>(errorFor(status.value()), headers, status);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiError> handleConstraintViolation(ConstraintViolationException exception) {
        return ResponseEntity.badRequest().body(errorFor(400));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpected(Exception exception) {
        log.error("Unhandled request exception", exception);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorFor(500));
    }

    static ApiError errorFor(int status) {
        return switch (status) {
            case 400 -> new ApiError("INVALID_INPUT", "입력값을 확인해 주세요.");
            case 401 -> new ApiError("UNAUTHORIZED", "로그인이 필요합니다.");
            case 403 -> new ApiError("FORBIDDEN", "접근 권한이 없습니다.");
            case 404 -> new ApiError("NOT_FOUND", "요청한 대상을 찾을 수 없습니다.");
            case 405 -> new ApiError("METHOD_NOT_ALLOWED", "지원하지 않는 요청 방식입니다.");
            case 409 -> new ApiError("CONFLICT", "요청이 현재 상태와 충돌합니다.");
            case 415 -> new ApiError("UNSUPPORTED_MEDIA_TYPE", "지원하지 않는 요청 형식입니다.");
            case 502 -> new ApiError("BAD_GATEWAY", "외부 서비스 연동에 실패했습니다.");
            case 503 -> new ApiError("SERVICE_UNAVAILABLE", "서비스를 일시적으로 사용할 수 없습니다.");
            default -> status >= 500
                    ? new ApiError("INTERNAL_SERVER_ERROR", "서버 오류가 발생했습니다.")
                    : new ApiError("REQUEST_ERROR", "요청을 처리할 수 없습니다.");
        };
    }
}
