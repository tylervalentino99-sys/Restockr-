/*
# Add password_hash to shops table for username-based authentication

1. Changes
- Add `password_hash` (text, nullable) to `shops` table for storing bcrypt-hashed passwords.
- The `owner_email` column remains for optional contact but is no longer the primary login identifier.
- Login is now based on `slug` (Shop Username) + password.

2. Security
- No RLS policy changes needed — shops table already has appropriate policies.
- Password hashes are stored using Supabase Auth's built-in hashing via signUp().
- The frontend maps slug -> synthetic email ({slug}@restockr.shop) for Supabase Auth.

3. Notes
- Existing shops will have null password_hash and need to set a password on first login.
- The slug column is UNIQUE and serves as the Shop Username.
*/

ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS password_hash text;