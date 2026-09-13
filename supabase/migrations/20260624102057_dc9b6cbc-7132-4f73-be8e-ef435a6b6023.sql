
DROP POLICY IF EXISTS "Anyone can submit an interview" ON public.interviews;
REVOKE INSERT ON public.interviews FROM anon, authenticated;
-- service_role retains ALL access; server functions insert via supabaseAdmin.
