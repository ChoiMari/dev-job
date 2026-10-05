package com.devjob.bookmark.dto;

import java.util.List;

public record BookmarkPage(List<BookmarkResponse> items, int page, int size, long totalElements) { }
