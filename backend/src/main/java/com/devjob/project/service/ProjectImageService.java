package com.devjob.project.service;

import com.devjob.project.entity.Project;
import com.devjob.project.entity.ProjectImage;
import com.devjob.project.repository.ProjectImageRepository;
import com.devjob.project.repository.ProjectRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

@Service
public class ProjectImageService {
    private static final long MAX_SIZE = 5L * 1024 * 1024;
    private final ProjectRepository projects;
    private final ProjectImageRepository images;
    private final String bucket;
    private final String region;

    public ProjectImageService(ProjectRepository projects, ProjectImageRepository images,
            @Value("${devjob.project-images.bucket:}") String bucket,
            @Value("${devjob.project-images.region:}") String region) {
        this.projects = projects; this.images = images; this.bucket = bucket.strip(); this.region = region.strip();
    }
    public record InitRequest(ProjectImage.Kind kind, String fileName, String contentType, long byteSize) { }
    public record UploadTicket(Long imageId, String uploadUrl, String contentType) { }
    public record ImageView(Long id, ProjectImage.Kind kind, String fileName, long byteSize, String viewUrl) { }
    public boolean available() { return !bucket.isBlank() && !region.isBlank(); }

    @Transactional
    public UploadTicket initiate(Long userId, Long projectId, InitRequest request) {
        configured();
        Project project = owned(userId, projectId, true);
        var stale = images.findByProject_IdOrderByIdAsc(projectId).stream()
                .filter(image -> image.getStatus() == ProjectImage.Status.PENDING
                        && image.getCreatedAt().isBefore(Instant.now().minus(Duration.ofMinutes(10)))).toList();
        removeAll(stale);
        if (request == null || request.kind() == null || request.fileName() == null || request.fileName().isBlank()
                || request.fileName().length() > 255 || request.fileName().codePoints().anyMatch(Character::isISOControl)
                || request.contentType() == null || !List.of("image/jpeg", "image/png").contains(request.contentType())
                || request.byteSize() < 1 || request.byteSize() > MAX_SIZE) throw error(HttpStatus.BAD_REQUEST);
        long limit = request.kind() == ProjectImage.Kind.THUMBNAIL ? 1 : 2;
        if (images.countByProject_IdAndKind(projectId, request.kind()) >= limit) throw error(HttpStatus.CONFLICT);
        String extension = request.contentType().equals("image/png") ? "png" : "jpg";
        String key = "projects/" + userId + "/" + projectId + "/" + UUID.randomUUID() + "." + extension;
        var image = images.save(new ProjectImage(project, key, request.kind(), request.fileName().strip(), request.contentType(), request.byteSize()));
        try (var presigner = presigner()) {
            var put = PutObjectRequest.builder().bucket(bucket).key(key).contentType(request.contentType()).build();
            var signed = presigner.presignPutObject(PutObjectPresignRequest.builder().signatureDuration(Duration.ofMinutes(5))
                    .putObjectRequest(put).build());
            return new UploadTicket(image.getId(), signed.url().toString(), request.contentType());
        }
    }
    @Transactional
    public ImageView complete(Long userId, Long projectId, Long imageId) {
        configured(); owned(userId, projectId);
        var image = image(projectId, imageId);
        if (image.getStatus() == ProjectImage.Status.PENDING) {
            try (var s3 = client()) {
                var head = s3.headObject(HeadObjectRequest.builder().bucket(bucket).key(image.getObjectKey()).build());
                if (head.contentLength() != image.getByteSize() || !image.getContentType().equals(head.contentType()))
                    throw error(HttpStatus.BAD_REQUEST);
                byte[] prefix = s3.getObjectAsBytes(GetObjectRequest.builder().bucket(bucket).key(image.getObjectKey())
                        .range("bytes=0-7").build()).asByteArray();
                if (!validSignature(image.getContentType(), prefix)) throw error(HttpStatus.BAD_REQUEST);
                image.ready();
            }
        }
        return view(image);
    }
    @Transactional(readOnly = true)
    public List<ImageView> list(Long userId, Long projectId) {
        configured(); owned(userId, projectId);
        return images.findByProject_IdOrderByIdAsc(projectId).stream()
                .filter(image -> image.getStatus() == ProjectImage.Status.READY).map(this::view).toList();
    }
    @Transactional
    public void remove(Long userId, Long projectId, Long imageId) {
        configured(); owned(userId, projectId);
        var image = image(projectId, imageId);
        try (var s3 = client()) { s3.deleteObject(builder -> builder.bucket(bucket).key(image.getObjectKey())); }
        images.delete(image);
    }
    @Transactional
    public void removeAllForProject(Long projectId) {
        removeAll(images.findByProject_IdOrderByIdAsc(projectId));
    }
    @Transactional
    public void removeAllForUser(Long userId) {
        removeAll(images.findByProject_User_Id(userId));
    }
    private void removeAll(List<ProjectImage> entries) {
        if (entries.isEmpty()) return;
        configured();
        try (var s3 = client()) {
            for (var image : entries) s3.deleteObject(builder -> builder.bucket(bucket).key(image.getObjectKey()));
        }
        images.deleteAll(entries);
        images.flush();
    }
    private ImageView view(ProjectImage image) {
        try (var presigner = presigner()) {
            var get = presigner.presignGetObject(GetObjectPresignRequest.builder().signatureDuration(Duration.ofMinutes(5))
                    .getObjectRequest(builder -> builder.bucket(bucket).key(image.getObjectKey())).build());
            return new ImageView(image.getId(), image.getKind(), image.getOriginalName(), image.getByteSize(), get.url().toString());
        }
    }
    private ProjectImage image(Long projectId, Long imageId) {
        if (imageId == null || imageId <= 0) throw error(HttpStatus.BAD_REQUEST);
        var image = images.findById(imageId).orElseThrow(() -> error(HttpStatus.NOT_FOUND));
        if (!image.getProjectId().equals(projectId)) throw error(HttpStatus.NOT_FOUND);
        return image;
    }
    private Project owned(Long userId, Long projectId) { return owned(userId, projectId, false); }
    private Project owned(Long userId, Long projectId, boolean lock) {
        if (projectId == null || projectId <= 0) throw error(HttpStatus.BAD_REQUEST);
        var project = (lock ? projects.findForUpdate(projectId) : projects.findById(projectId))
                .orElseThrow(() -> error(HttpStatus.NOT_FOUND));
        if (!project.getUserId().equals(userId)) throw error(HttpStatus.FORBIDDEN);
        return project;
    }
    private void configured() {
        if (bucket.isBlank() || region.isBlank()) throw error(HttpStatus.SERVICE_UNAVAILABLE);
    }
    private S3Client client() { return S3Client.builder().region(Region.of(region)).build(); }
    private S3Presigner presigner() { return S3Presigner.builder().region(Region.of(region)).build(); }
    private static boolean validSignature(String type, byte[] bytes) {
        byte[] png = {(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a};
        return type.equals("image/png") ? Arrays.equals(bytes, png)
                : bytes.length >= 3 && (bytes[0] & 0xff) == 0xff && (bytes[1] & 0xff) == 0xd8 && (bytes[2] & 0xff) == 0xff;
    }
    private ResponseStatusException error(HttpStatus status) { return new ResponseStatusException(status); }
}
