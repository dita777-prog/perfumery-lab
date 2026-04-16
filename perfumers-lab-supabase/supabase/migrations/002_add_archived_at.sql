-- Migration 002: Add archived_at column to formulas table
ALTER TABLE formulas ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
