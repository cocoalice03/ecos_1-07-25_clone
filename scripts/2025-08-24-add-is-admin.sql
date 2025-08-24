-- Add is_admin flag to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Optional: backfill specific admins here (uncomment and edit emails)
-- UPDATE users SET is_admin = TRUE WHERE email IN (
--   'cherubindavid@gmail.com',
--   'colombemadoungou@gmail.com',
--   'romain.guillevic@gmail.com'
-- );
