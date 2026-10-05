package com.devjob.user;

import com.devjob.user.entity.User;
import com.devjob.user.repository.UserRepository;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;

@Tag("database")
@SpringBootTest
@Transactional
class UserRepositoryTest {
    @Autowired UserRepository users;

    @Test
    void storesOnlyHashAndRejectsDuplicateEmailInDatabase() {
        var user = users.saveAndFlush(new User("repository@example.com", "test-hash-only"));
        assertThat(user.getId()).isPositive();
        assertThat(users.findByEmail("repository@example.com")).isPresent();
        assertThatThrownBy(() -> users.saveAndFlush(new User("repository@example.com", "other-hash")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void databaseRejectsUnnormalizedEmailEvenOutsideService() {
        assertThatThrownBy(() -> users.saveAndFlush(new User(" Upper@Example.com ", "test-hash-only")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
