package com.devjob.profile.entity;

import com.devjob.user.entity.User;
import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "profiles")
public class Profile {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;
    @Column(nullable = false, length = 100)
    private String name;
    @Column(name = "desired_role", length = 100)
    private String desiredRole;
    @Column(name = "career_level", length = 100)
    private String careerLevel;
    @Column(name = "desired_location", length = 100)
    private String desiredLocation;
    @Column(length = 2000)
    private String introduction;
    @Column(length = 1000)
    private String education;
    @Column(length = 1000)
    private String certifications;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Profile() { }
    public Profile(User user) { this.user = user; }
    public void update(String name, String desiredRole, String careerLevel, String desiredLocation,
            String introduction, String education, String certifications) {
        this.name = name;
        this.desiredRole = desiredRole;
        this.careerLevel = careerLevel;
        this.desiredLocation = desiredLocation;
        this.introduction = introduction;
        this.education = education;
        this.certifications = certifications;
        this.updatedAt = Instant.now();
    }
    public Long getId() { return id; }
    public String getName() { return name; }
    public String getDesiredRole() { return desiredRole; }
    public String getCareerLevel() { return careerLevel; }
    public String getDesiredLocation() { return desiredLocation; }
    public String getIntroduction() { return introduction; }
    public String getEducation() { return education; }
    public String getCertifications() { return certifications; }
}
