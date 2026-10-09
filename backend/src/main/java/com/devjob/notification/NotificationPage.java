package com.devjob.notification;

import java.util.List;

public record NotificationPage(List<NotificationDto> items, int page, int size, long totalElements) { }
