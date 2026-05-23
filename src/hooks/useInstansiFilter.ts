import { useAuth } from "@/hooks/useAuth";

/**
 * Hook untuk mendapatkan filter instansi yang efektif.
 *
 * Logika:
 * - Akun LOKAL (instansiId !== null): selalu filter ke instansinya sendiri
 * - Akun GLOBAL (instansiId === null):
 *   - Jika memilih cabang tertentu → filter ke cabang itu
 *   - Jika memilih "Semua Cabang" → kembalikan null (tidak ada filter)
 *
 * Cara penggunaan:
 *   const { effectiveInstansiId, applyFilter } = useInstansiFilter();
 *
 *   // Opsi 1: Manual
 *   let query = supabase.from("employees").select("*");
 *   if (effectiveInstansiId) query = query.eq("instansi_id", effectiveInstansiId);
 *
 *   // Opsi 2: Pakai helper
 *   const query = applyFilter(supabase.from("employees").select("*"));
 */
export function useInstansiFilter() {
  const { instansiId, selectedInstansiId, isGlobalRole } = useAuth();

  // Untuk akun lokal, gunakan instansiId miliknya sendiri
  // Untuk akun global, gunakan selectedInstansiId (bisa null = semua)
  const effectiveInstansiId: string | null = isGlobalRole
    ? selectedInstansiId
    : instansiId;

  /**
   * Helper untuk menyuntikkan filter instansi ke query Supabase secara otomatis.
   * Jika effectiveInstansiId adalah null (akun global + semua cabang), query tidak diubah.
   */
  function applyFilter<T extends { eq: (col: string, val: string) => T }>(query: T): T {
    if (effectiveInstansiId) {
      return query.eq("instansi_id", effectiveInstansiId);
    }
    return query;
  }

  return { effectiveInstansiId, applyFilter };
}
