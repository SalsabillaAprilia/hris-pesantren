
-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('super_admin', 'hr', 'unit_leader', 'employee');

-- Create enum for approval status
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved_unit_leader', 'approved_hr', 'rejected');

-- Create enum for task status
CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'done', 'cancelled');

-- Create enum for employee status
CREATE TYPE public.employee_status AS ENUM ('active', 'inactive', 'on_leave');

-- Create enum for approval type
CREATE TYPE public.approval_type AS ENUM ('leave', 'permission');

-- Create units table
CREATE TABLE public.units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create employees table
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  unit_id UUID REFERENCES public.units(id),
  position TEXT,
  join_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status public.employee_status NOT NULL DEFAULT 'active',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Create attendance table
CREATE TABLE public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  selfie_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, date)
);

-- Create approvals table
CREATE TABLE public.approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  type public.approval_type NOT NULL,
  status public.approval_status NOT NULL DEFAULT 'pending',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  unit_leader_notes TEXT,
  hr_notes TEXT,
  approved_by_unit_leader UUID REFERENCES auth.users(id),
  approved_by_hr UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES auth.users(id),
  due_date DATE,
  status public.task_status NOT NULL DEFAULT 'todo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create KPI templates table
CREATE TABLE public.kpi_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create KPI indicators table
CREATE TABLE public.kpi_indicators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.kpi_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  weight DECIMAL(5,2) NOT NULL CHECK (weight > 0 AND weight <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create KPI evaluations table
CREATE TABLE public.kpi_evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.kpi_templates(id),
  evaluator_id UUID NOT NULL REFERENCES auth.users(id),
  period TEXT NOT NULL,
  total_score DECIMAL(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create KPI scores table
CREATE TABLE public.kpi_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evaluation_id UUID NOT NULL REFERENCES public.kpi_evaluations(id) ON DELETE CASCADE,
  indicator_id UUID NOT NULL REFERENCES public.kpi_indicators(id),
  score DECIMAL(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create storage bucket for selfies
INSERT INTO storage.buckets (id, name, public) VALUES ('attendance-selfies', 'attendance-selfies', true);

-- Enable RLS on all tables
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpi_scores ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: check if user is admin or HR
CREATE OR REPLACE FUNCTION public.is_admin_or_hr(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('super_admin', 'hr')
  )
$$;

-- Helper: get employee unit_id
CREATE OR REPLACE FUNCTION public.get_employee_unit(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT unit_id FROM public.employees WHERE user_id = _user_id LIMIT 1
$$;

-- Units policies
CREATE POLICY "Units readable by authenticated" ON public.units FOR SELECT TO authenticated USING (true);
CREATE POLICY "Units writable by admin/hr" ON public.units FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_hr(auth.uid()));
CREATE POLICY "Units updatable by admin/hr" ON public.units FOR UPDATE TO authenticated USING (public.is_admin_or_hr(auth.uid()));
CREATE POLICY "Units deletable by admin/hr" ON public.units FOR DELETE TO authenticated USING (public.is_admin_or_hr(auth.uid()));

-- Employees policies
CREATE POLICY "Employees readable by authenticated" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Employees insertable by admin/hr" ON public.employees FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_hr(auth.uid()));
CREATE POLICY "Employees updatable by admin/hr or self" ON public.employees FOR UPDATE TO authenticated USING (public.is_admin_or_hr(auth.uid()) OR user_id = auth.uid());
CREATE POLICY "Employees deletable by admin/hr" ON public.employees FOR DELETE TO authenticated USING (public.is_admin_or_hr(auth.uid()));

-- User roles policies
CREATE POLICY "Roles readable by authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Roles insertable by super_admin" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Roles updatable by super_admin" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "Roles deletable by super_admin" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

-- Attendance policies
CREATE POLICY "Attendance read" ON public.attendance FOR SELECT TO authenticated
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR public.is_admin_or_hr(auth.uid())
    OR (public.has_role(auth.uid(), 'unit_leader') AND employee_id IN (
      SELECT id FROM public.employees WHERE unit_id = public.get_employee_unit(auth.uid())
    ))
  );
CREATE POLICY "Attendance insert" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));
CREATE POLICY "Attendance update" ON public.attendance FOR UPDATE TO authenticated
  USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));

-- Approvals policies
CREATE POLICY "Approvals read" ON public.approvals FOR SELECT TO authenticated
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR public.is_admin_or_hr(auth.uid())
    OR (public.has_role(auth.uid(), 'unit_leader') AND employee_id IN (
      SELECT id FROM public.employees WHERE unit_id = public.get_employee_unit(auth.uid())
    ))
  );
CREATE POLICY "Approvals insert" ON public.approvals FOR INSERT TO authenticated
  WITH CHECK (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));
CREATE POLICY "Approvals update" ON public.approvals FOR UPDATE TO authenticated
  USING (
    public.is_admin_or_hr(auth.uid())
    OR (public.has_role(auth.uid(), 'unit_leader') AND employee_id IN (
      SELECT id FROM public.employees WHERE unit_id = public.get_employee_unit(auth.uid())
    ))
  );

-- Tasks policies
CREATE POLICY "Tasks read" ON public.tasks FOR SELECT TO authenticated
  USING (
    assigned_to IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR public.is_admin_or_hr(auth.uid())
    OR assigned_by = auth.uid()
  );
CREATE POLICY "Tasks insert" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_hr(auth.uid()) OR public.has_role(auth.uid(), 'unit_leader'));
CREATE POLICY "Tasks update" ON public.tasks FOR UPDATE TO authenticated
  USING (
    assigned_to IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR public.is_admin_or_hr(auth.uid())
    OR assigned_by = auth.uid()
  );

-- KPI templates policies
CREATE POLICY "KPI templates read" ON public.kpi_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "KPI templates insert" ON public.kpi_templates FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_hr(auth.uid()));
CREATE POLICY "KPI templates update" ON public.kpi_templates FOR UPDATE TO authenticated USING (public.is_admin_or_hr(auth.uid()));
CREATE POLICY "KPI templates delete" ON public.kpi_templates FOR DELETE TO authenticated USING (public.is_admin_or_hr(auth.uid()));

CREATE POLICY "KPI indicators read" ON public.kpi_indicators FOR SELECT TO authenticated USING (true);
CREATE POLICY "KPI indicators insert" ON public.kpi_indicators FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_hr(auth.uid()));
CREATE POLICY "KPI indicators update" ON public.kpi_indicators FOR UPDATE TO authenticated USING (public.is_admin_or_hr(auth.uid()));
CREATE POLICY "KPI indicators delete" ON public.kpi_indicators FOR DELETE TO authenticated USING (public.is_admin_or_hr(auth.uid()));

-- KPI evaluations policies
CREATE POLICY "KPI evaluations read" ON public.kpi_evaluations FOR SELECT TO authenticated
  USING (
    employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR evaluator_id = auth.uid()
    OR public.is_admin_or_hr(auth.uid())
  );
CREATE POLICY "KPI evaluations insert" ON public.kpi_evaluations FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_hr(auth.uid()) OR public.has_role(auth.uid(), 'unit_leader'));
CREATE POLICY "KPI evaluations update" ON public.kpi_evaluations FOR UPDATE TO authenticated
  USING (evaluator_id = auth.uid() OR public.is_admin_or_hr(auth.uid()));

CREATE POLICY "KPI scores read" ON public.kpi_scores FOR SELECT TO authenticated
  USING (
    evaluation_id IN (
      SELECT id FROM public.kpi_evaluations WHERE
        employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
        OR evaluator_id = auth.uid()
        OR public.is_admin_or_hr(auth.uid())
    )
  );
CREATE POLICY "KPI scores insert" ON public.kpi_scores FOR INSERT TO authenticated
  WITH CHECK (
    evaluation_id IN (
      SELECT id FROM public.kpi_evaluations WHERE
        evaluator_id = auth.uid() OR public.is_admin_or_hr(auth.uid())
    )
  );
CREATE POLICY "KPI scores update" ON public.kpi_scores FOR UPDATE TO authenticated
  USING (
    evaluation_id IN (
      SELECT id FROM public.kpi_evaluations WHERE
        evaluator_id = auth.uid() OR public.is_admin_or_hr(auth.uid())
    )
  );

-- Storage policies
CREATE POLICY "Selfies publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'attendance-selfies');
CREATE POLICY "Users can upload selfies" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attendance-selfies');

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add triggers
CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_approvals_updated_at BEFORE UPDATE ON public.approvals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_kpi_templates_updated_at BEFORE UPDATE ON public.kpi_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_kpi_evaluations_updated_at BEFORE UPDATE ON public.kpi_evaluations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default units
INSERT INTO public.units (name, description) VALUES
  ('SMP', 'Sekolah Menengah Pertama'),
  ('SMA', 'Sekolah Menengah Atas'),
  ('Pesantren', 'Pondok Pesantren');

-- Auto-create employee profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.employees (user_id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), NEW.email);
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
