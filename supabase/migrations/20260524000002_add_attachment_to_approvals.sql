-- 1. Tambah kolom attachment_url pada tabel approvals
ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- 2. Buat storage bucket untuk menampung lampiran persetujuan
INSERT INTO storage.buckets (id, name, public) 
VALUES ('approval_attachments', 'approval_attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policies untuk bucket approval_attachments
DO $$
BEGIN
    -- Mengizinkan akses baca (SELECT) secara publik
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Approval attachments are publicly accessible'
    ) THEN
        CREATE POLICY "Approval attachments are publicly accessible" ON storage.objects 
          FOR SELECT USING (bucket_id = 'approval_attachments');
    END IF;

    -- Mengizinkan upload (INSERT) hanya untuk user yang terautentikasi
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Authenticated users can upload approval attachments'
    ) THEN
        CREATE POLICY "Authenticated users can upload approval attachments" ON storage.objects 
          FOR INSERT TO authenticated WITH CHECK (bucket_id = 'approval_attachments');
    END IF;

    -- Mengizinkan update untuk user terautentikasi (opsional)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Users can update their own approval attachments'
    ) THEN
        CREATE POLICY "Users can update their own approval attachments" ON storage.objects 
          FOR UPDATE TO authenticated USING (bucket_id = 'approval_attachments');
    END IF;

    -- Mengizinkan hapus untuk user terautentikasi (opsional)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' AND policyname = 'Users can delete their own approval attachments'
    ) THEN
        CREATE POLICY "Users can delete their own approval attachments" ON storage.objects 
          FOR DELETE TO authenticated USING (bucket_id = 'approval_attachments');
    END IF;
END
$$;
