CREATE TABLE character_equipment (
    user_id BIGINT PRIMARY KEY REFERENCES users(id),
    outfit_item_id VARCHAR(40) NOT NULL CHECK (outfit_item_id IN ('BASE', 'MINT')),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
