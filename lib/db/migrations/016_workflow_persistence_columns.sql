-- Migration: Add missing workflow persistence columns
-- Date: 2025-12-13

-- Add variables and metadata columns to workflow_executions
ALTER TABLE workflow_executions ADD COLUMN variables TEXT DEFAULT '{}';
ALTER TABLE workflow_executions ADD COLUMN metadata TEXT DEFAULT '{}';

-- Add metadata column to workflow_step_executions
ALTER TABLE workflow_step_executions ADD COLUMN metadata TEXT DEFAULT '{}';

-- Update existing records to have default JSON objects
UPDATE workflow_executions SET variables = '{}' WHERE variables IS NULL;
UPDATE workflow_executions SET metadata = '{}' WHERE metadata IS NULL;
UPDATE workflow_step_executions SET metadata = '{}' WHERE metadata IS NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_started_at ON workflow_executions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_execution_id ON workflow_step_executions(execution_id);
CREATE INDEX IF NOT EXISTS idx_workflow_step_executions_status ON workflow_step_executions(status);
