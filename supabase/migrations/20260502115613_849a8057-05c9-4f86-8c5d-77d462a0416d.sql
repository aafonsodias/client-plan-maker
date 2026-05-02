UPDATE public.subscribers
SET subscribed = true,
    subscription_status = 'founder',
    trial_end = NULL,
    current_period_end = NULL
WHERE lower(email) = 'aafonsodias@gmail.com';

UPDATE public.profiles
SET plan_quota_limit = 999999
WHERE user_id IN (SELECT user_id FROM public.subscribers WHERE lower(email) = 'aafonsodias@gmail.com');