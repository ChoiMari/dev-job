ALTER TABLE personal_todo_category
    ADD COLUMN color_key VARCHAR(20) NOT NULL DEFAULT 'blue'
        CHECK (color_key IN ('blue', 'green', 'pink', 'orange', 'yellow', 'purple', 'gray')),
    ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 1000;

ALTER TABLE personal_todo_category DROP CONSTRAINT personal_todo_category_icon_key_check;
ALTER TABLE personal_todo_category ADD CONSTRAINT ck_personal_todo_category_icon_key
    CHECK (icon_key IN ('document', 'interview', 'study', 'growth', 'health', 'travel', 'other',
        'briefcase', 'graduation', 'dumbbell', 'coffee', 'home', 'gamepad'));

INSERT INTO personal_todo_category (user_id, name, icon_key, color_key, sort_order)
SELECT users.id, defaults.name, defaults.icon_key, defaults.color_key, defaults.sort_order
FROM users CROSS JOIN (VALUES
    ('서류', 'document', 'green', 0),
    ('면접', 'interview', 'blue', 1),
    ('공부', 'study', 'pink', 2),
    ('자기계발', 'growth', 'orange', 3),
    ('일상', 'home', 'yellow', 4),
    ('취미', 'gamepad', 'purple', 5),
    ('여행', 'travel', 'blue', 6),
    ('기타', 'other', 'gray', 7)
) AS defaults(name, icon_key, color_key, sort_order)
ON CONFLICT (user_id, name) DO NOTHING;
