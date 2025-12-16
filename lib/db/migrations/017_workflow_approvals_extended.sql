-- Migration: Extend workflow_approvals table with additional fields
-- Date: 2025-12-13
-- Purpose: Add step_id and metadata columns for advanced approval workflow

-- Add step_id column to track which workflow step this approval belongs to
ALTER TABLE workflow_approvals ADD COLUMN step_id TEXT;

-- Add metadata column for storing additional approval data (JSON)
ALTER TABLE workflow_approvals ADD COLUMN metadata TEXT DEFAULT '{}';

-- Update status column to support additional states
-- Note: SQLite doesn't support ALTER COLUMN, so we need to handle this in the application layer
-- The new valid statuses are: 'pending', 'approved', 'rejected', 'cancelled', 'delegated', 'timeout'

-- Update existing records to have default metadata
UPDATE workflow_approvals SET metadata = '{}' WHERE metadata IS NULL;

-- Create index for step_id for better query performance
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_step ON workflow_approvals(step_id);
