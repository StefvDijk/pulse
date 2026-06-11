-- Fix: on_auth_user_created inserted into user_settings, whose user_id has a
-- FK to profiles(id) — but nothing created the profile first, so EVERY new
-- user creation (including via the admin API) failed with a FK violation.
-- Insert the profile first, then the settings row.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Sporter'))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_settings (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$function$;
