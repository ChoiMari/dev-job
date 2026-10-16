package com.devjob.auth.service;

import com.devjob.auth.dto.AccountDeletionRequest;
import com.devjob.auth.dto.DeletionImpactResponse;
import com.devjob.project.service.ProjectImageService;
import com.devjob.user.repository.UserRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AccountDeletionService {
    public static final String CONFIRMATION_TEXT = "계정 삭제";
    private static final String EXTERNAL_NOTICE = "운영 DB의 개인 기록은 즉시 삭제되며 앱에서 복구할 수 없습니다. "
            + "DB 백업과 이미 전송된 AI 제공자 사본은 이 요청으로 삭제를 보장하지 않으며 별도 보존 정책에 따릅니다.";

    // Every user-owned table appears here, including soft-deleted rows.
    // The order follows foreign keys from children to parents. The same list drives the impact response.
    private static final List<Resource> RESOURCES = List.of(
            direct("semantic_recommendation", "의미 기반 추천 결과"),
            indirect("document_analysis", "문서 AI 분석 결과",
                    "resume_version_id in (select v.id from resume_version v join resume r on r.id=v.resume_id where r.user_id=?)"
                    + " or cover_letter_version_id in (select v.id from cover_letter_version v join cover_letter c on c.id=v.cover_letter_id where c.user_id=?)", true),
            indirect("resume_version", "이력서 암호화 버전", "resume_id in (select id from resume where user_id=?)"),
            indirect("cover_letter_version", "자기소개서 암호화 버전", "cover_letter_id in (select id from cover_letter where user_id=?)"),
            direct("resume_draft", "이력서 작성 임시저장"),
            direct("cover_letter_draft", "자기소개서 작성 임시저장"),
            direct("resume", "이력서"),
            direct("cover_letter", "자기소개서"),
            direct("notification", "앱 내 알림"),
            direct("notification_preference", "알림 설정"),
            direct("interview_schedule", "면접 일정"),
            indirect("application_status_history", "지원 상태 이력", "application_id in (select id from application where user_id=?)"),
            direct("application", "지원 기록"),
            direct("user_ai_skill_candidate", "계정별 AI 기술 후보"),
            indirect("personal_saved_job_analysis", "개인 공고 AI 분석 결과",
                    "personal_saved_job_id in (select id from personal_saved_job where user_id=?)"),
            direct("personal_saved_job", "개인 저장 공고"),
            indirect("project_skill", "프로젝트 기술 연결", "project_id in (select id from project where user_id=?)"),
            indirect("project_custom_skill", "프로젝트 직접 입력 기술", "project_id in (select id from project where user_id=?)"),
            indirect("project_image", "프로젝트 이미지", "project_id in (select id from project where user_id=?)"),
            direct("project", "프로젝트"),
            direct("bookmark", "공용 공고 북마크"),
            direct("user_ai_analysis_request", "공용 공고 AI 기술 후보 요청"),
            direct("user_custom_skill", "직접 등록한 기술"),
            direct("user_skill", "보유 기술·숙련도·경험"),
            direct("profiles", "프로필"),
            direct("personal_todo", "개인 할 일"),
            indirect("interested_company_tag", "관심 기업 태그 연결",
                    "company_id in (select id from interested_company where user_id=?)"),
            direct("interested_company", "관심 기업"),
            direct("personal_company_tag", "관심 기업 사용자 태그"),
            direct("learning_goal", "학습 목표"),
            direct("character_activity", "캐릭터 활동·EXP"),
            direct("character_reward", "캐릭터 보상"),
            direct("character_equipment", "캐릭터 장착"),
            indirect("users", "계정·비밀번호 해시", "id=?")
    );
    private static final List<String> SHARED = List.of(
            "공용 채용공고·회사·출처·수집 실행 정보", "공용 공고 AI 분석·기술·전형·첨부 메타데이터",
            "공용 표준 기술·별칭");

    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final JdbcTemplate jdbc;
    private final ProjectImageService images;

    public AccountDeletionService(UserRepository users, PasswordEncoder passwords, JdbcTemplate jdbc, ProjectImageService images) {
        this.users = users;
        this.passwords = passwords;
        this.jdbc = jdbc;
        this.images = images;
    }

    @Transactional
    public DeletionImpactResponse impact(long userId) {
        users.findByIdForUpdate(userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        var deleted = RESOURCES.stream().map(resource -> new DeletionImpactResponse.Resource(
                resource.code(), resource.name(), count(resource, userId))).toList();
        return new DeletionImpactResponse(deleted, SHARED, CONFIRMATION_TEXT, false, "동기 처리·운영 DB 즉시 삭제",
                EXTERNAL_NOTICE);
    }

    @Transactional
    public void delete(long userId, AccountDeletionRequest request) {
        var user = users.findByIdForUpdate(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (!CONFIRMATION_TEXT.equals(request.confirmation()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        if (!passwords.matches(request.currentPassword(), user.getPasswordHash()))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        images.removeAllForUser(userId);
        for (Resource resource : RESOURCES) {
            int removed = resource.twoParameters()
                    ? jdbc.update(resource.deleteSql(), userId, userId)
                    : jdbc.update(resource.deleteSql(), userId);
            if (resource.code().equals("users") && removed != 1)
                throw new IllegalStateException("Account deletion did not remove the account");
        }
    }

    private long count(Resource resource, long userId) {
        return resource.twoParameters()
                ? jdbc.queryForObject(resource.countSql(), Long.class, userId, userId)
                : jdbc.queryForObject(resource.countSql(), Long.class, userId);
    }

    private static Resource direct(String table, String name) {
        return indirect(table, name, "user_id=?");
    }

    private static Resource indirect(String table, String name, String predicate) {
        return indirect(table, name, predicate, false);
    }

    private static Resource indirect(String table, String name, String predicate, boolean twoParameters) {
        return new Resource(table, name, "select count(*) from " + table + " where " + predicate,
                "delete from " + table + " where " + predicate, twoParameters);
    }

    private record Resource(String code, String name, String countSql, String deleteSql, boolean twoParameters) { }
}
