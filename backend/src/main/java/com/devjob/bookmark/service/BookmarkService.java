package com.devjob.bookmark.service;

import com.devjob.bookmark.dto.*;
import com.devjob.bookmark.repository.BookmarkRepository;
import com.devjob.job.repository.JobPostingRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class BookmarkService {
    private final BookmarkRepository bookmarks;
    private final JobPostingRepository jobs;
    public BookmarkService(BookmarkRepository bookmarks, JobPostingRepository jobs) {
        this.bookmarks = bookmarks; this.jobs = jobs;
    }

    @Transactional(readOnly = true)
    public BookmarkPage list(Long userId, int page, int size) {
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        }
        var result = bookmarks.findByUserId(userId, PageRequest.of(page, size,
                Sort.by(Sort.Direction.DESC, "createdAt", "id")));
        return new BookmarkPage(result.getContent().stream().map(BookmarkResponse::from).toList(),
                page, size, result.getTotalElements());
    }

    @Transactional
    public BookmarkResponse add(Long userId, AddBookmarkRequest input) {
        if (input.jobId() == null || input.jobId() < 1) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        if (!jobs.existsById(input.jobId())) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        if (bookmarks.add(userId, input.jobId()) == 0) throw new ResponseStatusException(HttpStatus.CONFLICT);
        return BookmarkResponse.from(bookmarks.findByUserIdAndJobId(userId, input.jobId()).orElseThrow());
    }

    @Transactional
    public void delete(Long userId, long jobId) {
        if (jobId < 1) throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
        if (bookmarks.remove(userId, jobId) == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    }
}
