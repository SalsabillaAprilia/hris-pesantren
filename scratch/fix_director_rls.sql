-- ==============================================================================
-- Script: Perbaikan RLS untuk Role Director di Modul KPI
-- ==============================================================================
-- Deskripsi:
-- Script ini memperbarui kebijakan RLS (Row Level Security) yang sudah ada pada
-- tabel-tabel KPI agar "director" (yang merupakan global role dengan instansi_id = null)
-- tetap dapat membaca (SELECT) data dari semua tabel KPI berdasarkan cabang yang dipilih.
-- ==============================================================================

-- 1. Evaluasi KPI (kpi_evaluations)
DROP POLICY IF EXISTS "kpi_evaluations_select" ON kpi_evaluations;
CREATE POLICY "kpi_evaluations_select" ON kpi_evaluations FOR SELECT USING (
  -- Super Admin & Director bisa baca semuanya
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'director'))
  OR
  -- Karyawan terkait, penilai, atau HR/Kepala Unit yang instansinya cocok
  EXISTS (
    SELECT 1 FROM employees e 
    JOIN user_roles ur ON ur.instansi_id = e.instansi_id 
    WHERE e.id = kpi_evaluations.employee_id 
    AND ur.user_id = auth.uid()
  )
);

-- 2. Template KPI (kpi_templates)
DROP POLICY IF EXISTS "kpi_templates_select" ON kpi_templates;
CREATE POLICY "kpi_templates_select" ON kpi_templates FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'director'))
  OR instansi_id IN (SELECT instansi_id FROM user_roles WHERE user_id = auth.uid())
);

-- 3. Indikator KPI (kpi_indicators)
DROP POLICY IF EXISTS "kpi_indicators_select" ON kpi_indicators;
CREATE POLICY "kpi_indicators_select" ON kpi_indicators FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'director'))
  OR EXISTS (
    SELECT 1 FROM kpi_templates t 
    WHERE t.id = kpi_indicators.template_id 
    AND t.instansi_id IN (SELECT instansi_id FROM user_roles WHERE user_id = auth.uid())
  )
);

-- 4. Skor KPI (kpi_scores)
DROP POLICY IF EXISTS "kpi_scores_select" ON kpi_scores;
CREATE POLICY "kpi_scores_select" ON kpi_scores FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('super_admin', 'director'))
  OR EXISTS (
    SELECT 1 FROM kpi_evaluations e
    JOIN employees emp ON emp.id = e.employee_id
    WHERE e.id = kpi_scores.evaluation_id
    AND emp.instansi_id IN (SELECT instansi_id FROM user_roles WHERE user_id = auth.uid())
  )
);
