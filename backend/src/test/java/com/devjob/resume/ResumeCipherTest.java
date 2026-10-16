package com.devjob.resume;

import com.devjob.resume.service.ResumeCipher;
import java.util.Base64;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.assertj.core.api.Assertions.*;

class ResumeCipherTest {
    private static ResumeCipher cipher() {
        return new ResumeCipher(Base64.getEncoder().encodeToString(new byte[32]));
    }
    @Test void encryptsWithFreshNonceAndBindsCiphertextToVersion() {
        var cipher = cipher();
        var first = cipher.encrypt(1L, 1, "민감한 이력서");
        var second = cipher.encrypt(1L, 1, "민감한 이력서");
        assertThat(first.nonce()).hasSize(12).isNotEqualTo(second.nonce());
        assertThat(first.ciphertext()).isNotEqualTo(second.ciphertext());
        assertThat(cipher.decrypt(1L, 1, first.ciphertext(), first.nonce())).isEqualTo("민감한 이력서");
        assertThatThrownBy(() -> cipher.decrypt(1L, 2, first.ciphertext(), first.nonce()))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> cipher.decrypt(2L, 1, first.ciphertext(), first.nonce()))
                .isInstanceOf(ResponseStatusException.class);
    }
    @Test void missingOrMalformedKeyDoesNotExposeContent() {
        for (String key : new String[] {"", "invalid", Base64.getEncoder().encodeToString(new byte[16])}) {
            assertThatThrownBy(() -> new ResumeCipher(key).encrypt(1L, 1, "SECRET-RESUME"))
                    .isInstanceOf(ResponseStatusException.class)
                    .hasMessageNotContaining("SECRET-RESUME");
        }
    }
    @Test void formEncryptionUsesSeparateVersionBoundAad() {
        var cipher = cipher();
        var form = cipher.encryptForm(1L, 3, "{\"name\":\"홍길동\"}");
        assertThat(cipher.decryptForm(1L, 3, form.ciphertext(), form.nonce())).contains("홍길동");
        assertThatThrownBy(() -> cipher.decryptForm(1L, 2, form.ciphertext(), form.nonce()))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> cipher.decrypt(1L, 3, form.ciphertext(), form.nonce()))
                .isInstanceOf(ResponseStatusException.class);
    }
}
