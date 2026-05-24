-- ============================================================
-- Migration: Refactor KPI Schema
-- Date: 2026-05-24
-- Description:
--   1. Remove global kpi_settings table (thresholds moved per-template)
--   2. Add passing grade columns to kpi_templates
--   3. Add description column to kpi_indicators (rubric)
--   4. Refactor kpi_evaluations: replace period (TEXT) with
--      start_date / end_date, add status enum, qualitative_feedback
-- ============================================================

-- ── 1. Drop kpi_settings table (predikat global digantikan per-template) ──────
DROP TABLE IF EXISTS public.kpi_settings;

-- ── 2. Enum: kpi_evaluation_status ───────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.kpi_evaluation_status AS ENUM ('TODO', 'DRAFT', 'SUBMITTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── 3. kpi_templates: tambah kolom passing grade & scale per-template ─────────
ALTER TABLE public.kpi_templates
  ADD COLUMN IF NOT EXISTS scale                 INTEGER       NOT NULL DEFAULT 100 CHECK (scale > 0),
  ADD COLUMN IF NOT EXISTS threshold_sangat_baik DECIMAL(5,2)  NOT NULL DEFAULT 85  CHECK (threshold_sangat_baik >= 0),
  ADD COLUMN IF NOT EXISTS threshold_baik        DECIMAL(5,2)  NOT NULL DEFAULT 70  CHECK (threshold_baik >= 0),
  ADD COLUMN IF NOT EXISTS threshold_cukup       DECIMAL(5,2)  NOT NULL DEFAULT 55  CHECK (threshold_cukup >= 0);

-- Pastikan urutan logis threshold
ALTER TABLE public.kpi_templates
  ADD CONSTRAINT kpi_templates_thresholds_order
    CHECK (threshold_sangat_baik > threshold_baik AND threshold_baik > threshold_cukup AND threshold_cukup >= 0);

-- ── 4. kpi_indicators: tambah kolom description (rubrik penilaian) ────────────
ALTER TABLE public.kpi_indicators
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL;

-- ── 5. kpi_evaluations: tambah kolom baru ─────────────────────────────────────
ALTER TABLE public.kpi_evaluations
  ADD COLUMN IF NOT EXISTS start_date           DATE                          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS end_date             DATE                          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS status               public.kpi_evaluation_status  NOT NULL DEFAULT 'TODO',
  ADD COLUMN IF NOT EXISTS qualitative_feedback TEXT                          DEFAULT NULL;

-- Constraint: end_date harus >= start_date jika keduanya diisi
ALTER TABLE public.kpi_evaluations
  ADD CONSTRAINT kpi_evaluations_date_range
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date);

-- ── 6. Migrate data lama: isi start_date / end_date dari kolom period ──────────
-- Contoh konservatif: set default range jika period terisi
-- (Sesuaikan jika ada format periode yang spesifik)
UPDATE public.kpi_evaluations
  SET start_date = created_at::DATE,
      end_date   = (created_at + INTERVAL '1 month - 1 day')::DATE
  WHERE start_date IS NULL AND end_date IS NULL;

-- ── 7. Drop kolom period (TEXT) yang sudah tidak digunakan ────────────────────
ALTER TABLE public.kpi_evaluations
  DROP COLUMN IF EXISTS period;

-- ── 8. Index untuk performa query berdasarkan status & range tanggal ──────────
CREATE INDEX IF NOT EXISTS idx_kpi_evaluations_status
  ON public.kpi_evaluations (status);

CREATE INDEX IF NOT EXISTS idx_kpi_evaluations_date_range
  ON public.kpi_evaluations (start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_kpi_evaluations_employee_status
  ON public.kpi_evaluations (employee_id, status);
