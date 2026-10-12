package com.devjob.todo.repository;

import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class TodoCategoryRepository {
    public record Category(long id, String name, String iconKey, String colorKey, int sortOrder) { }
    private final JdbcTemplate jdbc;
    public TodoCategoryRepository(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public void seedDefaults(long userId) {
        if (count(userId) != 0) return;
        jdbc.update("""
            insert into personal_todo_category(user_id,name,icon_key,color_key,sort_order)
            select ?, defaults.name, defaults.icon_key, defaults.color_key, defaults.sort_order
            from (values
                ('서류','document','green',0), ('면접','interview','blue',1),
                ('공부','study','pink',2), ('자기계발','growth','orange',3),
                ('일상','home','yellow',4), ('취미','gamepad','purple',5),
                ('여행','travel','blue',6), ('기타','other','gray',7)
            ) defaults(name,icon_key,color_key,sort_order)
            on conflict (user_id,name) do nothing
            """, userId);
    }
    public List<Category> list(long userId) {
        return jdbc.query("select id,name,icon_key,color_key,sort_order from personal_todo_category where user_id=? order by sort_order,id",
                (rs, row) -> new Category(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getInt(5)), userId);
    }
    public int count(long userId) {
        Integer count = jdbc.queryForObject("select count(*) from personal_todo_category where user_id=?", Integer.class, userId);
        return count == null ? 0 : count;
    }
    public boolean exists(long userId, String name) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "select exists(select 1 from personal_todo_category where user_id=? and name=?)",
                Boolean.class, userId, name));
    }
    public Category create(long userId, String name, String iconKey, String colorKey) {
        Integer nextOrder = jdbc.queryForObject(
                "select coalesce(max(sort_order)+1,0) from personal_todo_category where user_id=?", Integer.class, userId);
        Long id = jdbc.queryForObject("insert into personal_todo_category(user_id,name,icon_key,color_key,sort_order) values (?,?,?,?,?) returning id",
                Long.class, userId, name, iconKey, colorKey, nextOrder);
        return new Category(id, name, iconKey, colorKey, nextOrder);
    }
    public Category update(long userId, long id, String name, String iconKey, String colorKey) {
        jdbc.update("update personal_todo_category set name=?,icon_key=?,color_key=? where user_id=? and id=?",
                name, iconKey, colorKey, userId, id);
        return get(userId, id);
    }
    public void renameTodos(long userId, String oldName, String newName) {
        jdbc.update("update personal_todo set category=? where user_id=? and category=?", newName, userId, oldName);
    }
    public void reorder(long userId, List<Long> ids) {
        for (int index = 0; index < ids.size(); index++) {
            jdbc.update("update personal_todo_category set sort_order=? where user_id=? and id=?", index, userId, ids.get(index));
        }
    }
    public boolean inUse(long userId, String name) {
        return Boolean.TRUE.equals(jdbc.queryForObject(
                "select exists(select 1 from personal_todo where user_id=? and deleted_at is null and category=?)",
                Boolean.class, userId, name));
    }
    public boolean delete(long userId, long id) {
        return jdbc.update("delete from personal_todo_category where user_id=? and id=?", userId, id) == 1;
    }
    public Category get(long userId, long id) {
        return jdbc.query("select id,name,icon_key,color_key,sort_order from personal_todo_category where user_id=? and id=? for update",
                rs -> rs.next() ? new Category(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4), rs.getInt(5)) : null,
                userId, id);
    }
}
