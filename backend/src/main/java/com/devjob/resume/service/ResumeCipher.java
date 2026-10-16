package com.devjob.resume.service;

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
public class ResumeCipher {
    private final String encodedKey;
    private final SecureRandom random = new SecureRandom();

    public ResumeCipher(@Value("${RESUME_ENCRYPTION_KEY:}") String encodedKey) { this.encodedKey = encodedKey; }

    public record Encrypted(byte[] ciphertext, byte[] nonce) { }

    public Encrypted encrypt(Long resumeId, int versionNumber, String content) {
        try {
            byte[] nonce = new byte[12];
            random.nextBytes(nonce);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key(), new GCMParameterSpec(128, nonce));
            cipher.updateAAD(aad(resumeId, versionNumber));
            return new Encrypted(cipher.doFinal(content.getBytes(StandardCharsets.UTF_8)), nonce);
        } catch (ResponseStatusException exception) { throw exception; }
        catch (Exception exception) { throw unavailable(); }
    }

    public String decrypt(Long resumeId, int versionNumber, byte[] ciphertext, byte[] nonce) {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, nonce));
            cipher.updateAAD(aad(resumeId, versionNumber));
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (ResponseStatusException exception) { throw exception; }
        catch (Exception exception) { throw unavailable(); }
    }

    public Encrypted encryptForm(Long resumeId, int versionNumber, String form) {
        try {
            byte[] nonce = new byte[12];
            random.nextBytes(nonce);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key(), new GCMParameterSpec(128, nonce));
            cipher.updateAAD(formAad(resumeId, versionNumber));
            return new Encrypted(cipher.doFinal(form.getBytes(StandardCharsets.UTF_8)), nonce);
        } catch (ResponseStatusException exception) { throw exception; }
        catch (Exception exception) { throw unavailable(); }
    }

    public String decryptForm(Long resumeId, int versionNumber, byte[] ciphertext, byte[] nonce) {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, nonce));
            cipher.updateAAD(formAad(resumeId, versionNumber));
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (ResponseStatusException exception) { throw exception; }
        catch (Exception exception) { throw unavailable(); }
    }

    public Encrypted encryptDraft(Long userId, String content) {
        try {
            byte[] nonce = new byte[12];
            random.nextBytes(nonce);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key(), new GCMParameterSpec(128, nonce));
            cipher.updateAAD(draftAad(userId));
            return new Encrypted(cipher.doFinal(content.getBytes(StandardCharsets.UTF_8)), nonce);
        } catch (ResponseStatusException exception) { throw exception; }
        catch (Exception exception) { throw unavailable(); }
    }

    public String decryptDraft(Long userId, byte[] ciphertext, byte[] nonce) {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, nonce));
            cipher.updateAAD(draftAad(userId));
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (ResponseStatusException exception) { throw exception; }
        catch (Exception exception) { throw unavailable(); }
    }

    private static byte[] draftAad(Long userId) {
        return ByteBuffer.allocate(13).put((byte) 1).putInt(0).putLong(userId).array();
    }

    private static byte[] formAad(Long resumeId, int versionNumber) {
        return ByteBuffer.allocate(13).put((byte) 2).putLong(resumeId).putInt(versionNumber).array();
    }

    private SecretKeySpec key() {
        try {
            byte[] decoded = Base64.getDecoder().decode(encodedKey);
            if (decoded.length != 32) throw unavailable();
            return new SecretKeySpec(decoded, "AES");
        } catch (IllegalArgumentException exception) { throw unavailable(); }
    }

    private static byte[] aad(Long resumeId, int versionNumber) {
        return ByteBuffer.allocate(12).putLong(resumeId).putInt(versionNumber).array();
    }

    private static ResponseStatusException unavailable() {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE);
    }
}
