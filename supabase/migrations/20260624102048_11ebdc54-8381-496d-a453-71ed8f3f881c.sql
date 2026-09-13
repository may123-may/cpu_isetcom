
CREATE TABLE public.interviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id TEXT NOT NULL,
  candidate_name TEXT NOT NULL,
  candidate_role TEXT NOT NULL,
  language TEXT NOT NULL,
  conversation JSONB NOT NULL,
  rank_reached TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT INSERT ON public.interviews TO anon, authenticated;
GRANT ALL ON public.interviews TO service_role;

ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a completed interview (no SELECT for anon — admins read via service role)
CREATE POLICY "Anyone can submit an interview"
  ON public.interviews FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
