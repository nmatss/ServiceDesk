-- Migration: Add push subscriptions table for PWA
-- Version: 009
-- Description: Creates table for storing web push notification subscriptions

-- Push subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    subscription_data TEXT NOT NULL, -- JSON data with keys
    device_info TEXT, -- JSON data with device information
    active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, endpoint)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
ON push_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active
ON push_subscriptions(active);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_push_subscriptions_timestamp
AFTER UPDATE ON push_subscriptions
FOR EACH ROW
BEGIN
    UPDATE push_subscriptions
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

-- Sync queue table for offline actions
CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    action_type TEXT NOT NULL, -- CREATE_TICKET, ADD_COMMENT, etc.
    action_data TEXT NOT NULL, -- JSON data
    status TEXT DEFAULT 'pending', -- pending, syncing, completed, failed
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    synced_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for sync queue
CREATE INDEX IF NOT EXISTS idx_sync_queue_user_status
ON sync_queue(user_id, status);

CREATE INDEX IF NOT EXISTS idx_sync_queue_created
ON sync_queue(created_at);

-- Trigger for sync queue updated_at
CREATE TRIGGER IF NOT EXISTS update_sync_queue_timestamp
AFTER UPDATE ON sync_queue
FOR EACH ROW
BEGIN
    UPDATE sync_queue
    SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;
