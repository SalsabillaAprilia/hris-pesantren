import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Building2, ArrowRight } from "lucide-react";

interface GlobalModeGuardProps {
  children: React.ReactNode;
}

/**
 * Guard yang memblokir akses ke halaman operasional saat
 * akun Global berada dalam mode "Semua Cabang" (selectedInstansiId = null).
 * 
 * Tampilkan placeholder informatif yang meminta user memilih cabang dulu
 * via dropdown di header, alih-alih membiarkan mereka memasukkan data
 * yang akan tersimpan dengan instansi_id = null.
 */
export function GlobalModeGuard({ children }: GlobalModeGuardProps) {
  const { isGlobalRole, selectedInstansiId } = useAuth();

  // Cek apakah sedang di global mode tanpa cabang terpilih
  const isGlobalModeWithoutBranch = isGlobalRole && !selectedInstansiId;

  if (isGlobalModeWithoutBranch) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-24 text-center px-4">
          <div className="relative mb-6">
            <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Building2 className="h-10 w-10 text-primary/60" />
            </div>
            <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-amber-100 border-2 border-white flex items-center justify-center">
              <span className="text-amber-600 text-xs font-bold">!</span>
            </div>
          </div>

          <h2 className="text-xl font-bold text-foreground mb-2">
            Pilih Cabang Terlebih Dahulu
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-6">
            Halaman ini hanya dapat diakses dalam konteks cabang tertentu.
            Silakan pilih cabang yang ingin Anda kelola melalui menu di bagian atas.
          </p>

          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-2.5 border">
            <span>Klik dropdown cabang di</span>
            <ArrowRight className="h-3 w-3 shrink-0" />
            <span className="font-medium text-foreground">Header atas</span>
            <span>untuk memilih cabang</span>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return <>{children}</>;
}
