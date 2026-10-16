CREATE TABLE resume_draft (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    content_ciphertext BYTEA NOT NULL,
    content_nonce BYTEA NOT NULL CHECK (octet_length(content_nonce) = 12),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
