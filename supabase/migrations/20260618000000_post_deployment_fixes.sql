-- Kolom rincian tugas jabatan
ALTER TABLE positions ADD COLUMN IF NOT EXISTS description TEXT;

-- Kolom akad karyawan
ALTER TABLE employees ADD COLUMN IF NOT EXISTS contract_type VARCHAR(50) 
  DEFAULT 'Kontrak' 
  CHECK (contract_type IN ('Tetap', 'Kontrak', 'Honorer', 'Magang', 'Part Time', 'Lainnya'));

-- Tambahan untuk Revisi Tugas
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'revision';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS manager_notes TEXT;
