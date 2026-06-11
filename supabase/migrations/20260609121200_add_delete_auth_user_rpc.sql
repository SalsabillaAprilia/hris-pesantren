CREATE OR REPLACE FUNCTION public.delete_auth_user(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Cek apakah user yang memanggil fungsi ini adalah admin/hr
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'hr', 'director')
  ) THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya admin yang dapat menghapus akun.';
  END IF;

  -- Hapus dari auth.users
  -- Relasi tabel employees dan user_roles yang menggunakan ON DELETE CASCADE 
  -- akan terhapus otomatis di level database.
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;
