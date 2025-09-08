-- Create payroll tables
CREATE TABLE public.payroll_employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  ni_number TEXT NOT NULL,
  tax_code TEXT NOT NULL DEFAULT '1257L',
  ni_category TEXT NOT NULL DEFAULT 'A',
  annual_salary NUMERIC NOT NULL DEFAULT 30000,
  pay_frequency TEXT NOT NULL DEFAULT 'MTH',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.payroll_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  period TEXT NOT NULL,
  pay_date DATE NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.payroll_run_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES payroll_employees(id) ON DELETE CASCADE,
  gross_pay NUMERIC NOT NULL DEFAULT 0,
  tax_deduction NUMERIC NOT NULL DEFAULT 0,
  ni_deduction NUMERIC NOT NULL DEFAULT 0,
  net_pay NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.payroll_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  submission_type TEXT NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reference_number TEXT,
  status TEXT NOT NULL DEFAULT 'submitted'
);

-- Enable RLS
ALTER TABLE public.payroll_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_run_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_submissions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can manage their own payroll employees"
ON public.payroll_employees FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own payroll runs"
ON public.payroll_runs FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own payroll run items"
ON public.payroll_run_items FOR ALL
USING (
  EXISTS(SELECT 1 FROM payroll_runs r WHERE r.id = run_id AND r.user_id = auth.uid())
)
WITH CHECK (
  EXISTS(SELECT 1 FROM payroll_runs r WHERE r.id = run_id AND r.user_id = auth.uid())
);

CREATE POLICY "Users can manage their own payroll submissions"
ON public.payroll_submissions FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_payroll_employees_updated_at
  BEFORE UPDATE ON public.payroll_employees
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_payroll_runs_updated_at
  BEFORE UPDATE ON public.payroll_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();