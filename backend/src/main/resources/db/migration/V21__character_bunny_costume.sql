ALTER TABLE character_equipment
    DROP CONSTRAINT character_equipment_outfit_item_id_check;

ALTER TABLE character_equipment
    ADD CONSTRAINT character_equipment_outfit_item_id_check
    CHECK (outfit_item_id IN ('BASE', 'MINT', 'BUNNY'));
