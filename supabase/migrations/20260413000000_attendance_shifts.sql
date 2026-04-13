-- Migration 20260413000000_attendance_shifts.sql
-- Create work_shifts table
CREATE TABLE public.work_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  late_tolerance_minutes INT NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on work_shifts
ALTER TABLE public.work_shifts ENABLE ROW LEVEL SECURITY;

-- Policies for work_shifts
CREATE POLICY "Work shifts readable by authenticated" ON public.work_shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Work shifts insertable by admin/hr" ON public.work_shifts FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_hr(auth.uid()));
CREATE POLICY "Work shifts updatable by admin/hr" ON public.work_shifts FOR UPDATE TO authenticated USING (public.is_admin_or_hr(auth.uid()));
CREATE POLICY "Work shifts deletable by admin/hr" ON public.work_shifts FOR DELETE TO authenticated USING (public.is_admin_or_hr(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_work_shifts_updated_at BEFORE UPDATE ON public.work_shifts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add shift_id to employees
ALTER TABLE public.employees ADD COLUMN shift_id UUID REFERENCES public.work_shifts(id) ON DELETE SET NULL;

-- Modify attendance table
ALTER TABLE public.attendance ADD COLUMN check_in_location TEXT;
ALTER TABLE public.attendance ADD COLUMN check_out_location TEXT;
ALTER TABLE public.attendance ADD COLUMN check_in_method TEXT DEFAULT 'selfie';
ALTER TABLE public.attendance ADD COLUMN check_out_method TEXT;
ALTER TABLE public.attendance ADD COLUMN late_minutes INT DEFAULT 0;
ALTER TABLE public.attendance ADD COLUMN overtime_minutes INT DEFAULT 0;
ALTER TABLE public.attendance ADD COLUMN daily_status TEXT;

-- Seed default shift
INSERT INTO public.work_shifts (id, name, start_time, end_time, late_tolerance_minutes) 
VALUES ('11111111-1111-1111-1111-111111111111', 'Shift Normal', '07:30', '15:00', 15);
