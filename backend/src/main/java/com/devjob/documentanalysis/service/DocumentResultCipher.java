package com.devjob.documentanalysis.service;

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
public class DocumentResultCipher {
    private final String encodedKey;
    private final SecureRandom random = new SecureRandom();
    public record Encrypted(byte[] ciphertext, byte[] nonce) { }
    public DocumentResultCipher(@Value("${RESUME_ENCRYPTION_KEY:}") String encodedKey) { this.encodedKey = encodedKey; }
    public Encrypted encrypt(long analysisId, String result) {
        try {
            byte[] nonce = new byte[12]; random.nextBytes(nonce);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key(), new GCMParameterSpec(128, nonce));
            cipher.updateAAD(aad(analysisId));
            return new Encrypted(cipher.doFinal(result.getBytes(StandardCharsets.UTF_8)), nonce);
        } catch (ResponseStatusException exception) { throw exception; }
        catch (Exception exception) { throw unavailable(); }
    }
    public String decrypt(long analysisId, byte[] ciphertext, byte[] nonce) {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, nonce));
            cipher.updateAAD(aad(analysisId));
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (ResponseStatusException exception) { throw exception; }
        catch (Exception exception) { throw unavailable(); }
    }
    private SecretKeySpec key() {
        try {
            byte[] decoded = Base64.getDecoder().decode(encodedKey);
            if (decoded.length != 32) throw unavailable();
            return new SecretKeySpec(decoded, "AES");
        } catch (IllegalArgumentException exception) { throw unavailable(); }
    }
    private static byte[] aad(long id) { return ByteBuffer.allocate(16).putLong(0x444F43414E414C59L).putLong(id).array(); }
    private static ResponseStatusException unavailable() { return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE); }
}
