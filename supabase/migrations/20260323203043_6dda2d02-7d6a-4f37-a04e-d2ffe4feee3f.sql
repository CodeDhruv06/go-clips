
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS verification_code text,
  ADD COLUMN IF NOT EXISTS instagram_verified boolean NOT NULL DEFAULT false;

ALTER TABLE public.campaigns 
  ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE public.submissions 
  ADD COLUMN IF NOT EXISTS views integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS earnings numeric(10,2) NOT NULL DEFAULT 0;

-- Update existing campaigns with placeholder images
UPDATE public.campaigns SET image_url = 'https://images.unsplash.com/photo-1461896836934-bd45ba84a094?w=600&h=400&fit=crop' WHERE title ILIKE '%cricket%';
UPDATE public.campaigns SET image_url = 'https://images.unsplash.com/photo-1518091043644-c1d4457512c6?w=600&h=400&fit=crop' WHERE title ILIKE '%football%';
UPDATE public.campaigns SET image_url = 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=600&h=400&fit=crop' WHERE image_url IS NULL;
