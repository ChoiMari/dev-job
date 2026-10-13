ALTER TABLE personal_company_tag
    ADD COLUMN color_key VARCHAR(20) NOT NULL DEFAULT 'blue',
    ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE personal_company_tag ADD CONSTRAINT ck_personal_company_tag_color
    CHECK (color_key IN ('blue','green','pink','yellow','purple','sky','orange','red','mint','gray'));

WITH ranked AS (
    SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY id) + 7 AS next_order
    FROM personal_company_tag
)
UPDATE personal_company_tag tag SET sort_order = ranked.next_order
FROM ranked WHERE tag.id = ranked.id;

INSERT INTO personal_company_tag (user_id, name, color_key, sort_order)
SELECT u.id, preset.name, preset.color_key, preset.sort_order
FROM users u
CROSS JOIN (VALUES
    ('AI','blue',0), ('백엔드','green',1), ('프론트엔드','pink',2),
    ('클라우드','mint',3), ('데이터','purple',4), ('핀테크','sky',5),
    ('커머스','orange',6), ('모바일','yellow',7)
) AS preset(name,color_key,sort_order)
ON CONFLICT (user_id, name) DO NOTHING;

CREATE INDEX ix_personal_company_tag_order ON personal_company_tag (user_id, sort_order, id);
