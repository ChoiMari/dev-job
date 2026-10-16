package com.devjob.project.entity;

import jakarta.persistence.*;
import java.time.Instant;

@Entity @Table(name = "project_image")
public class ProjectImage {
    public enum Kind { THUMBNAIL, ADDITIONAL }
    public enum Status { PENDING, READY }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "project_id") private Project project;
    @Column(name = "object_key", nullable = false, length = 300) private String objectKey;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private Kind kind;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 16) private Status status;
    @Column(name = "original_name", nullable = false, length = 255) private String originalName;
    @Column(name = "content_type", nullable = false, length = 32) private String contentType;
    @Column(name = "byte_size", nullable = false) private long byteSize;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;

    protected ProjectImage() { }
    public ProjectImage(Project project, String key, Kind kind, String name, String type, long size) {
        this.project = project; this.objectKey = key; this.kind = kind; this.status = Status.PENDING;
        this.originalName = name; this.contentType = type; this.byteSize = size; this.createdAt = Instant.now();
    }
    public Long getId() { return id; }
    public Long getProjectId() { return project.getId(); }
    public String getObjectKey() { return objectKey; }
    public Kind getKind() { return kind; }
    public Status getStatus() { return status; }
    public String getOriginalName() { return originalName; }
    public String getContentType() { return contentType; }
    public long getByteSize() { return byteSize; }
    public Instant getCreatedAt() { return createdAt; }
    public void ready() { status = Status.READY; }
}
