ALTER TABLE character_equipment
    ADD COLUMN hair_item_id VARCHAR(40) NOT NULL DEFAULT 'CLASSIC'
        CHECK (hair_item_id IN ('CLASSIC', 'BOB', 'PONY')),
    ADD COLUMN glasses_item_id VARCHAR(40) NOT NULL DEFAULT 'NONE'
        CHECK (glasses_item_id IN ('NONE', 'ROUND', 'SQUARE'));
