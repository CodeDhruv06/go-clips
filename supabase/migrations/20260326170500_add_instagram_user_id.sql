ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS instagram_user_id text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_instagram_user_id_key
  ON public.profiles (instagram_user_id)
  WHERE instagram_user_id IS NOT NULL;
