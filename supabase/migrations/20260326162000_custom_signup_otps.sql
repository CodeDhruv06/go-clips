CREATE TABLE public.signup_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  otp_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.signup_otps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access to signup otps" ON public.signup_otps
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.set_signup_otps_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_signup_otps_updated_at
  BEFORE UPDATE ON public.signup_otps
  FOR EACH ROW
  EXECUTE FUNCTION public.set_signup_otps_updated_at();
