package com.devjob.bookmark.controller;

import com.devjob.auth.dto.CurrentUser;
import com.devjob.bookmark.dto.*;
import com.devjob.bookmark.service.BookmarkService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/bookmarks")
public class BookmarkController {
    private final BookmarkService bookmarks;
    public BookmarkController(BookmarkService bookmarks) { this.bookmarks = bookmarks; }
    @GetMapping
    public BookmarkPage list(@AuthenticationPrincipal CurrentUser user,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return bookmarks.list(user.id(), page, size);
    }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public BookmarkResponse add(@AuthenticationPrincipal CurrentUser user, @Valid @RequestBody AddBookmarkRequest input) {
        return bookmarks.add(user.id(), input);
    }
    @DeleteMapping("/{jobId}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser user, @PathVariable long jobId) {
        bookmarks.delete(user.id(), jobId);
    }
}
