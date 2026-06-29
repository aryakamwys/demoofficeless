-- Create signatures table for auto-applying signatures
CREATE TABLE IF NOT EXISTS public.signatures (
  employee_id UUID PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  signature TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
