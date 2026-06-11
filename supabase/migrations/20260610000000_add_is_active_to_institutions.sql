-- Add is_active flag to institutions table for archiving instead of hard delete
ALTER TABLE "public"."institutions" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true;
