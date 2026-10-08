package com.devjob.character;

import com.devjob.character.dto.EquipItemRequest;
import com.devjob.character.repository.CharacterEquipmentRepository;
import com.devjob.character.service.CharacterService;
import com.devjob.user.entity.User;
import com.devjob.user.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.*;
import java.util.UUID;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import static org.assertj.core.api.Assertions.*;

@Tag("database") @EnabledIfEnvironmentVariable(named = "DB_NAME", matches = "devjob_b09_test")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class CharacterDatabaseTest {
    @LocalServerPort int port;
    @Autowired UserRepository users;
    @Autowired CharacterEquipmentRepository equipment;
    @Autowired CharacterService characters;
    @Autowired PasswordEncoder passwords;
    @Autowired ObjectMapper json;
    private final HttpClient http = HttpClient.newHttpClient();

    private HttpResponse<String> request(String method, String path, String cookie, String token, String body) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path));
        if (cookie != null) builder.header("Cookie", cookie);
        if (token != null) builder.header("X-CSRF-TOKEN", token);
        if (body != null) builder.header("Content-Type", "application/json");
        builder.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body));
        return http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }
    private record Session(String cookie, String csrf) { }
    private Session login(String email) throws Exception {
        var csrf = request("GET", "/api/auth/csrf", null, null, null);
        String cookie = csrf.headers().firstValue("Set-Cookie").orElseThrow().split(";", 2)[0];
        String token = json.readTree(csrf.body()).get("token").asText();
        var login = request("POST", "/api/auth/login", cookie, token,
                "{\"email\":\"" + email + "\",\"password\":\"password123\"}");
        assertThat(login.statusCode()).isEqualTo(200);
        cookie = login.headers().firstValue("Set-Cookie").orElseThrow().split(";", 2)[0];
        var fresh = request("GET", "/api/auth/csrf", cookie, null, null);
        return new Session(cookie, json.readTree(fresh.body()).get("token").asText());
    }

    @Test void ownershipLockedItemsPersistenceAndConcurrentUpdates() throws Exception {
        String suffix = UUID.randomUUID().toString();
        User owner = users.saveAndFlush(new User("b09-" + suffix + "@example.com", passwords.encode("password123")));
        User other = users.saveAndFlush(new User("b09-other-" + suffix + "@example.com", passwords.encode("password123")));
        try {
            Session first = login(owner.getEmail());
            assertThat(json.readTree(request("GET", "/api/me/character", first.cookie(), null, null).body())
                    .get("equippedItemId").asText()).isEqualTo("BASE");
            var items = json.readTree(request("GET", "/api/character/items", first.cookie(), null, null).body());
            assertThat(items.size()).isEqualTo(9);
            assertThat(items.get(1).get("assetId").asText()).isEqualTo("EXT-IMG-06C");
            assertThat(items.get(1).get("thumbnailAssetId").asText()).isEqualTo("EXT-IMG-06E");
            assertThat(items.get(2).get("available").asBoolean()).isFalse();
            assertThat(items.get(5).get("slot").asText()).isEqualTo("HAIR");
            assertThat(items.get(8).get("slot").asText()).isEqualTo("GLASSES");
            var firstPool = Executors.newFixedThreadPool(2);
            var firstStart = new CountDownLatch(1);
            try {
                Future<?> a = firstPool.submit(() -> { await(firstStart); characters.equip(owner.getId(), "OUTFIT", new EquipItemRequest("MINT")); });
                Future<?> b = firstPool.submit(() -> { await(firstStart); characters.equip(owner.getId(), "OUTFIT", new EquipItemRequest("MINT")); });
                firstStart.countDown();
                a.get(10, TimeUnit.SECONDS);
                b.get(10, TimeUnit.SECONDS);
                assertThat(equipment.count()).isEqualTo(1);
            } finally { firstPool.shutdownNow(); }
            assertThat(request("PUT", "/api/me/character/equipment/OUTFIT", first.cookie(), first.csrf(),
                    "{\"itemId\":\"PEACH\"}").statusCode()).isEqualTo(409);
            assertThat(request("PUT", "/api/me/character/equipment/GLASSES", first.cookie(), first.csrf(),
                    "{\"itemId\":\"BOB\"}").statusCode()).isEqualTo(400);
            assertThat(request("PUT", "/api/me/character/equipment/HAT", first.cookie(), first.csrf(),
                    "{\"itemId\":\"BOB\"}").statusCode()).isEqualTo(400);
            assertThat(request("PUT", "/api/me/character/equipment/HAIR", first.cookie(), first.csrf(),
                    "{\"itemId\":\"BOB\"}").statusCode()).isEqualTo(200);
            assertThat(request("PUT", "/api/me/character/equipment/GLASSES", first.cookie(), first.csrf(),
                    "{\"itemId\":\"SQUARE\"}").statusCode()).isEqualTo(200);
            for (int i = 0; i < 2; i++) {
                assertThat(request("PUT", "/api/me/character/equipment/OUTFIT", first.cookie(), first.csrf(),
                        "{\"itemId\":\"MINT\"}").statusCode()).isEqualTo(200);
            }
            assertThat(equipment.count()).isEqualTo(1);
            Session second = login(other.getEmail());
            assertThat(json.readTree(request("GET", "/api/me/character", second.cookie(), null, null).body())
                    .get("equippedItemId").asText()).isEqualTo("BASE");
            assertThat(request("POST", "/api/auth/logout", first.cookie(), first.csrf(), null).statusCode()).isEqualTo(204);
            Session again = login(owner.getEmail());
            assertThat(json.readTree(request("GET", "/api/me/character", again.cookie(), null, null).body())
                    .get("equippedItemId").asText()).isEqualTo("MINT");
            var restored = json.readTree(request("GET", "/api/me/character", again.cookie(), null, null).body());
            assertThat(restored.get("equipment").get("HAIR").asText()).isEqualTo("BOB");
            assertThat(restored.get("equipment").get("GLASSES").asText()).isEqualTo("SQUARE");

            var pool = Executors.newFixedThreadPool(2);
            var start = new CountDownLatch(1);
            try {
                Future<?> a = pool.submit(() -> { await(start); characters.equip(owner.getId(), "HAIR", new EquipItemRequest("PONY")); });
                Future<?> b = pool.submit(() -> { await(start); characters.equip(owner.getId(), "GLASSES", new EquipItemRequest("ROUND")); });
                start.countDown();
                a.get(10, TimeUnit.SECONDS);
                b.get(10, TimeUnit.SECONDS);
                assertThat(equipment.count()).isEqualTo(1);
                assertThat(characters.state(owner.getId()).equipment())
                        .containsEntry("OUTFIT", "MINT").containsEntry("HAIR", "PONY").containsEntry("GLASSES", "ROUND");
                assertThat(characters.state(other.getId()).equippedItemId()).isEqualTo("BASE");
            } finally { pool.shutdownNow(); }
        } finally {
            equipment.deleteById(owner.getId());
            users.deleteById(owner.getId());
            users.deleteById(other.getId());
        }
    }
    private static void await(CountDownLatch latch) {
        try { latch.await(); } catch (InterruptedException exception) { Thread.currentThread().interrupt(); throw new RuntimeException(exception); }
    }
}
