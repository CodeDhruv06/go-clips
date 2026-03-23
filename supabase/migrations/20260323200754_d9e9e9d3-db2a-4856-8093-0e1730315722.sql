
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  instagram_connected BOOLEAN NOT NULL DEFAULT false,
  instagram_username TEXT,
  followers_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create campaigns table
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Sports', 'General', 'Gambling')),
  reward_per_million_views INTEGER NOT NULL DEFAULT 100,
  rules TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Closed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view campaigns" ON public.campaigns FOR SELECT USING (true);

-- Create submissions table
CREATE TABLE public.submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  reel_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Flagged')),
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own submissions" ON public.submissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create submissions" ON public.submissions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Seed some campaigns
INSERT INTO public.campaigns (title, description, category, reward_per_million_views, rules, status) VALUES
('Nike Summer Sprint Challenge', 'Create an engaging reel showcasing your best sprint moments wearing Nike gear. Show energy, passion, and athleticism!', 'Sports', 300, ARRAY['Minimum 1K followers required', 'Must feature Nike products', 'Reel must be submitted within 30 minutes of upload', 'No explicit content allowed'], 'Active'),
('Daily Vibes Content Creator', 'Share your daily routine, lifestyle tips, or creative moments. We want authentic, relatable content that resonates with Gen Z audiences.', 'General', 100, ARRAY['Minimum 1K followers required', 'Content must be original', 'Reel must be submitted within 30 minutes of upload', 'Family-friendly content only'], 'Active'),
('Casino Royale Promo', 'Create exciting content around casino experiences, poker nights, or sports betting moments. High energy content preferred!', 'Gambling', 500, ARRAY['Minimum 1K followers required', 'Must be 21+ to participate', 'Reel must be submitted within 30 minutes of upload', 'Must include responsible gambling disclaimer'], 'Active'),
('Adidas Street Style', 'Show off your street style with Adidas gear. Urban settings, creative transitions, and bold fashion statements welcome.', 'Sports', 250, ARRAY['Minimum 1K followers required', 'Must feature Adidas products', 'Reel must be submitted within 30 minutes of upload', 'Outdoor locations preferred'], 'Active'),
('Wellness Journey', 'Document your wellness journey - yoga, meditation, healthy eating, or mental health awareness. Inspire others to live better.', 'General', 150, ARRAY['Minimum 1K followers required', 'Content must promote positive wellness', 'Reel must be submitted within 30 minutes of upload', 'No medical claims allowed'], 'Closed');
