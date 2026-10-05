package com.devjob.job.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "job_source")
public class JobSource {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, columnDefinition = "text", unique = true)
    private String code;
    @Column(columnDefinition = "text")
    private String name;

    protected JobSource() { }

    public JobSource(String code, String name) {
        this.code = code;
        this.name = name;
    }

    public Long getId() { return id; }
    public String getCode() { return code; }
    public String getName() { return name; }
}
