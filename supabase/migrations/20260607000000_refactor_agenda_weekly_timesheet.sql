-- ============================================================
-- Migration: Refactor Agenda → Weekly Timesheet (Parent-Child)
-- Tanggal: 2026-06-07
-- Deskripsi: Mengganti sistem pencatatan kegiatan harian (flat)
--            dengan sistem Laporan Mingguan berbasis Parent-Child.
--            Tabel `agendas` lama di-DROP (sudah dikonfirmasi kosong).
-- ============================================================

-- Langkah 1: Drop tabel lama (sudah dikonfirmasi tidak ada data)
DROP TABLE IF EXISTS public.agendas CASCADE;

-- Langkah 2: Drop enum lama yang tidak terpakai lagi
DROP TYPE IF EXISTS public.agenda_status;

-- Langkah 3: Buat ENUM baru untuk status laporan mingguan
DO $$ BEGIN
  CREATE TYPE public.report_status AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'REVISION_REQUESTED',
    'APPROVED'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- Langkah 4: Buat tabel induk agenda_reports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agenda_reports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  instansi_id    UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  status         public.report_status NOT NULL DEFAULT 'DRAFT',
  manager_notes  TEXT,
  approved_by    UUID REFERENCES auth.users(id),
  approved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_agenda_reports_employee_week UNIQUE (employee_id, start_date),
  CONSTRAINT chk_agenda_reports_dates CHECK (end_date >= start_date)
);

COMMENT ON TABLE public.agenda_reports IS 'Laporan agenda mingguan karyawan (parent). Satu baris = satu periode Senin-Minggu.';

CREATE INDEX IF NOT EXISTS idx_agenda_reports_employee   ON public.agenda_reports(employee_id);
CREATE INDEX IF NOT EXISTS idx_agenda_reports_instansi   ON public.agenda_reports(instansi_id);
CREATE INDEX IF NOT EXISTS idx_agenda_reports_status     ON public.agenda_reports(status);
CREATE INDEX IF NOT EXISTS idx_agenda_reports_start_date ON public.agenda_reports(start_date DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_agenda_reports_updated_at
  BEFORE UPDATE ON public.agenda_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Langkah 5: Buat tabel anak agenda_items
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agenda_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id         UUID NOT NULL REFERENCES public.agenda_reports(id) ON DELETE CASCADE,
  date              DATE NOT NULL,
  duration_minutes  INTEGER NOT NULL DEFAULT 30,
  activity          TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_agenda_items_duration CHECK (duration_minutes >= 5 AND duration_minutes <= 1440)
);

COMMENT ON TABLE public.agenda_items IS 'Item kegiatan individual dalam laporan mingguan (child).';

CREATE INDEX IF NOT EXISTS idx_agenda_items_report ON public.agenda_items(report_id);
CREATE INDEX IF NOT EXISTS idx_agenda_items_date   ON public.agenda_items(date);

-- ============================================================
-- Langkah 6: Enable Row Level Security
-- ============================================================
ALTER TABLE public.agenda_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_items   ENABLE ROW LEVEL SECURITY;

-- Karyawan: akses penuh ke laporan sendiri
CREATE POLICY "own_reports_all"
  ON public.agenda_reports FOR ALL
  USING (employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid()));

-- Unit Leader: lihat laporan dari unitnya
CREATE POLICY "unit_leader_view_reports"
  ON public.agenda_reports FOR SELECT
  USING (
    public.has_role(auth.uid(), 'unit_leader')
    AND employee_id IN (
      SELECT e.id FROM public.employees e
      WHERE e.unit_id = (SELECT unit_id FROM public.employees WHERE user_id = auth.uid() LIMIT 1)
    )
  );

-- Unit Leader: update status laporan dari unitnya
CREATE POLICY "unit_leader_update_reports"
  ON public.agenda_reports FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'unit_leader')
    AND employee_id IN (
      SELECT e.id FROM public.employees e
      WHERE e.unit_id = (SELECT unit_id FROM public.employees WHERE user_id = auth.uid() LIMIT 1)
    )
  );

-- Admin/HR: baca semua
CREATE POLICY "admin_hr_view_reports"
  ON public.agenda_reports FOR SELECT
  USING (public.is_admin_or_hr(auth.uid()));

-- agenda_items: akses mengikuti parent report
CREATE POLICY "items_via_report"
  ON public.agenda_items FOR ALL
  USING (report_id IN (SELECT id FROM public.agenda_reports));
