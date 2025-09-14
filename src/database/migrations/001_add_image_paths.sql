-- Migration: Add additional image path fields to records table
-- This migration adds fields to support local caching of Discogs and iTunes images

-- Add new image path columns to records table
ALTER TABLE records 
ADD COLUMN IF NOT EXISTS discogs_image_local_path TEXT,
ADD COLUMN IF NOT EXISTS itunes_image_local_path TEXT;

-- Add comment to track migration
COMMENT ON COLUMN records.discogs_image_local_path IS 'Local file path for cached Discogs album art';
COMMENT ON COLUMN records.itunes_image_local_path IS 'Local file path for cached iTunes album art';

-- Create index for faster lookups on image paths (optional performance improvement)
CREATE INDEX IF NOT EXISTS idx_records_discogs_image ON records(discogs_image_local_path) WHERE discogs_image_local_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_records_itunes_image ON records(itunes_image_local_path) WHERE itunes_image_local_path IS NOT NULL;

-- Print completion message
DO $$
BEGIN
    RAISE NOTICE 'Migration 001_add_image_paths completed successfully';
END
$$;