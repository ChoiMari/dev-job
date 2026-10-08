package com.devjob.todo.repository;

import com.devjob.todo.entity.PersonalTodo;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface PersonalTodoRepository extends JpaRepository<PersonalTodo, Long> {
    @Query("select t from PersonalTodo t where t.user.id = :userId and t.deletedAt is null "
            + "and (:completed is null or (:completed = true and t.completedAt is not null) "
            + "or (:completed = false and t.completedAt is null)) "
            + "order by case when t.dueAt is null then 1 else 0 end, t.dueAt asc, t.id desc")
    Page<PersonalTodo> list(@Param("userId") Long userId, @Param("completed") Boolean completed, Pageable pageable);

    @Query("select t from PersonalTodo t where t.user.id = :userId and t.deletedAt is null "
            + "and t.completedAt is null order by case when t.dueAt is null then 1 else 0 end, t.dueAt asc, t.id desc")
    List<PersonalTodo> dashboard(@Param("userId") Long userId, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from PersonalTodo t where t.id = :id")
    Optional<PersonalTodo> findForUpdate(@Param("id") Long id);
}
