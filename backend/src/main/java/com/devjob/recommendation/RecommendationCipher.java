package com.devjob.recommendation;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class RecommendationCipher {
    public record Encrypted(byte[] ciphertext, byte[] nonce) { }
    private final String encodedKey;
    private final SecureRandom random = new SecureRandom();
    public RecommendationCipher(@Value("${RESUME_ENCRYPTION_KEY:}") String encodedKey) { this.encodedKey = encodedKey; }
    public Encrypted encrypt(long id, String text) {
        try {
            byte[] nonce = new byte[12]; random.nextBytes(nonce);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key(), new GCMParameterSpec(128, nonce));
            cipher.updateAAD(aad(id));
            return new Encrypted(cipher.doFinal(text.getBytes(StandardCharsets.UTF_8)), nonce);
        } catch (ResponseStatusException exception) { throw exception; }
        catch (Exception exception) { throw unavailable(); }
    }
    public String decrypt(long id, byte[] ciphertext, byte[] nonce) {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, nonce));
            cipher.updateAAD(aad(id));
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (Exception exception) { throw unavailable(); }
    }
    public boolean available() {
        try { key(); return true; } catch (ResponseStatusException exception) { return false; }
    }
    private SecretKeySpec key() {
        try {
            byte[] key = Base64.getDecoder().decode(encodedKey);
            if (key.length != 32) throw unavailable();
            return new SecretKeySpec(key, "AES");
        } catch (IllegalArgumentException exception) { throw unavailable(); }
    }
    private static byte[] aad(long id) { return ByteBuffer.allocate(16).putLong(0x53454D5245434F4DL).putLong(id).array(); }
    private static ResponseStatusException unavailable() { return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE); }
}
