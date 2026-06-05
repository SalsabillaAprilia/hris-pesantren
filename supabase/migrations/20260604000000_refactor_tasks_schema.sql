-- ============================================================
-- Migration: Refactor Tasks Schema
-- Date: 2026-06-04
-- Description:
--   1. Tambah enum task_priority (Low, Medium, High)
--   2. Tambah kolom priority, checklists, kpi_indicator_id
--   3. Tambah kolom instansi_id (nullable dulu, enforce NOT NULL manual)
--   4. Index performa
--   5. Update RLS policy Tasks read agar unit_leader scope terjaga
-- ============================================================

-- ── 1. Enum task_priority ─────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.task_priority AS ENUM ('Low', 'Medium', 'High');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Kolom priority ─────────────────────────────────────────────────────────
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS priority public.task_priority NOT NULL DEFAULT 'Medium';

-- ── 3. Kolom checklists (JSONB array of {title, is_done}) ─────────────────────
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS checklists JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ── 4. Kolom kpi_indicator_id (Nullable FK → kpi_indicators) ─────────────────
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS kpi_indicator_id UUID
    REFERENCES public.kpi_indicators(id) ON DELETE SET NULL;

-- ── 5. Kolom instansi_id (Nullable FK → institutions) ────────────────────────
--
-- CATATAN PENTING: Kolom dibuat NULLABLE terlebih dahulu.
-- Setelah data lama diisi manual via Supabase Dashboard, jalankan:
--   ALTER TABLE public.tasks ALTER COLUMN instansi_id SET NOT NULL;
--
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS instansi_id UUID
    REFERENCES public.institutions(id) ON DELETE CASCADE;

-- ── 6. Index performa ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_instansi_id
  ON public.tasks (instansi_id);

CREATE INDEX IF NOT EXISTS idx_tasks_priority
  ON public.tasks (priority);

CREATE INDEX IF NOT EXISTS idx_tasks_due_date
  ON public.tasks (due_date);

CREATE INDEX IF NOT EXISTS idx_tasks_status
  ON public.tasks (status);

-- ── 7. Update RLS: Tasks read ─────────────────────────────────────────────────
-- Policy lama tidak menyertakan scope instansi di level DB.
-- Filter instansi tetap dilakukan di application layer (effectiveInstansiId)
-- karena director adalah global role tanpa instansi_id di user_roles.
-- Policy read tetap sama, hanya dipastikan unit_leader tercakup via assigned_by.
DROP POLICY IF EXISTS "Tasks read" ON public.tasks;
CREATE POLICY "Tasks read" ON public.tasks FOR SELECT TO authenticated
  USING (
    -- Karyawan melihat tugasnya sendiri
    assigned_to IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    -- Admin / HR melihat semua
    OR public.is_admin_or_hr(auth.uid())
    -- Unit Leader melihat tugas yang dia buat
    OR assigned_by = auth.uid()
    -- Unit Leader melihat tugas anggota unitnya
    OR (
      public.has_role(auth.uid(), 'unit_leader')
      AND assigned_to IN (
        SELECT id FROM public.employees
        WHERE unit_id = public.get_employee_unit(auth.uid())
      )
    )
  );

-- ── 8. Update RLS: Tasks insert ───────────────────────────────────────────────
-- Pastikan hanya unit_leader dan admin/hr yang bisa membuat tugas.
DROP POLICY IF EXISTS "Tasks insert" ON public.tasks;
CREATE POLICY "Tasks insert" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin_or_hr(auth.uid())
    OR public.has_role(auth.uid(), 'unit_leader')
  );

-- ── 9. Update RLS: Tasks update ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Tasks update" ON public.tasks;
CREATE POLICY "Tasks update" ON public.tasks FOR UPDATE TO authenticated
  USING (
    assigned_to IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
    OR public.is_admin_or_hr(auth.uid())
    OR assigned_by = auth.uid()
    OR (
      public.has_role(auth.uid(), 'unit_leader')
      AND assigned_to IN (
        SELECT id FROM public.employees
        WHERE unit_id = public.get_employee_unit(auth.uid())
      )
    )
  );

-- ── 10. RLS: Tasks delete (unit_leader + admin/hr) ────────────────────────────
DROP POLICY IF EXISTS "Tasks delete" ON public.tasks;
CREATE POLICY "Tasks delete" ON public.tasks FOR DELETE TO authenticated
  USING (
    public.is_admin_or_hr(auth.uid())
    OR assigned_by = auth.uid()
  );
