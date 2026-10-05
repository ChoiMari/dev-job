package com.devjob.auth.dto;

import java.io.Serializable;

public record CurrentUser(Long id, String email) implements Serializable { }
