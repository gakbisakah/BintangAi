-- Migration: Add weak_topics to profiles and tags to modules
-- Description: Adds columns to support Adaptive Learning system.
-- weak_topics: stores an array of topics where the student needs more practice.
-- tags: stores an array of topics relevant to the module for matching.

DO $$
BEGIN
    -- 1. Add weak_topics to profiles
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'profiles'
        AND column_name = 'weak_topics'
    ) THEN
        ALTER TABLE profiles ADD COLUMN weak_topics TEXT[] DEFAULT '{}';
    END IF;

    -- 2. Add tags to modules for Adaptive Recommendation
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'modules'
        AND column_name = 'tags'
    ) THEN
        ALTER TABLE modules ADD COLUMN tags TEXT[] DEFAULT '{}';
    END IF;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
