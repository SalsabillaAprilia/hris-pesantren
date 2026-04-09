-- Menambahkan kolom leader_id ke tabel units
-- leader_id merujuk ke tabel employees(id)
ALTER TABLE public.units 
ADD COLUMN IF NOT EXISTS leader_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

-- Komentar untuk dokumentasi
COMMENT ON COLUMN public.units.leader_id IS 'ID Karyawan yang menjabat sebagai Kepala Unit';
