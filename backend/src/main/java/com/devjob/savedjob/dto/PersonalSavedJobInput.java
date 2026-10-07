package com.devjob.savedjob.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record PersonalSavedJobInput(
        @NotBlank @Size(max = 2048) String url,
        @NotBlank @Size(max = 200) String companyName,
        @NotBlank @Size(max = 300) String title,
        @Size(max = 120) String role,
        @Size(max = 120) String careerLevel,
        @Size(max = 200) String location,
        @Size(max = 120) String employmentType,
        LocalDate deadlineDate,
        @Size(max = 2000) String note,
        @Size(max = 12000) String description) { }
