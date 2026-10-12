ALTER TABLE personal_todo_category DROP CONSTRAINT ck_personal_todo_category_icon_key;
ALTER TABLE personal_todo_category ADD CONSTRAINT ck_personal_todo_category_icon_key
    CHECK (icon_key IN ('document', 'interview', 'study', 'growth', 'health', 'travel', 'other',
        'briefcase', 'graduation', 'dumbbell', 'coffee', 'home', 'gamepad',
        'sun', 'people', 'music', 'lightbulb', 'star'));

ALTER TABLE personal_todo_category DROP CONSTRAINT personal_todo_category_color_key_check;
ALTER TABLE personal_todo_category ADD CONSTRAINT ck_personal_todo_category_color_key
    CHECK (color_key IN ('blue', 'green', 'pink', 'orange', 'yellow', 'purple', 'sky', 'gray'));
