-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT,
  full_name TEXT,
  tagline TEXT,
  logo_url TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  primary_color TEXT DEFAULT '#10b981',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trainers view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "trainers insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "trainers update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- CLIENTS
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  age INT,
  sex TEXT,
  height_cm NUMERIC,
  weight_kg NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trainers manage own clients" ON public.clients FOR ALL USING (auth.uid() = trainer_id) WITH CHECK (auth.uid() = trainer_id);

-- ASSESSMENTS
CREATE TABLE public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  primary_goal TEXT,
  secondary_goals TEXT[],
  experience_level TEXT,
  training_days_per_week INT,
  session_duration_minutes INT,
  available_equipment TEXT[],
  training_location TEXT,
  injuries TEXT,
  medical_conditions TEXT,
  preferences TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trainers manage own assessments" ON public.assessments FOR ALL USING (auth.uid() = trainer_id) WITH CHECK (auth.uid() = trainer_id);

-- WORKOUT PLANS
CREATE TABLE public.workout_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Workout Plan',
  summary TEXT,
  duration_weeks INT DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'draft',
  plan_data JSONB NOT NULL DEFAULT '{"weeks":[]}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workout_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trainers manage own plans" ON public.workout_plans FOR ALL USING (auth.uid() = trainer_id) WITH CHECK (auth.uid() = trainer_id);

-- SUBSCRIBERS (for Stripe)
CREATE TABLE public.subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  stripe_customer_id TEXT,
  subscribed BOOLEAN NOT NULL DEFAULT false,
  subscription_tier TEXT,
  subscription_status TEXT,
  trial_end TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own subscription" ON public.subscribers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "edge functions insert subscriptions" ON public.subscribers FOR INSERT WITH CHECK (true);
CREATE POLICY "edge functions update subscriptions" ON public.subscribers FOR UPDATE USING (true);

-- timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_assessments_updated BEFORE UPDATE ON public.assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON public.workout_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_subscribers_updated BEFORE UPDATE ON public.subscribers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- auto profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, contact_email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- storage bucket for logos
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);

CREATE POLICY "logos public read" ON storage.objects FOR SELECT USING (bucket_id = 'logos');
CREATE POLICY "trainers upload own logo" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "trainers update own logo" ON storage.objects FOR UPDATE
  USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "trainers delete own logo" ON storage.objects FOR DELETE
  USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);