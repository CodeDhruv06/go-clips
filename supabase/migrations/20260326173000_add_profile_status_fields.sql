ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS instagram_connection_status text NOT NULL DEFAULT 'not_connected';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_account_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_status_check
  CHECK (account_status IN ('active', 'banned', 'suspended'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_instagram_connection_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_instagram_connection_status_check
  CHECK (instagram_connection_status IN ('not_connected', 'approval_pending', 'approved', 'rejected'));

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_key
  ON public.profiles (lower(email))
  WHERE email IS NOT NULL AND btrim(email) <> '';
