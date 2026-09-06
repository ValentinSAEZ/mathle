-- Apply manually after a database backup, before deploying the profile backend.
BEGIN;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_image text NOT NULL DEFAULT ''
  CHECK (length(avatar_image) <= 24000);
COMMIT;
