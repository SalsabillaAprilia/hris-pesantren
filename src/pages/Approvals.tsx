import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { supabaseFetchWithTimeout } from "@/utils/supabase-fetch";
import { ApprovalInboxTable } from "@/components/approvals/ApprovalInboxTable";
import { supabase } from "@/integrations/supabase/client";

export default function Approvals() {
  const { user, employee, isAdminOrHr, isSuperAdmin, hasRole } = useAuth();
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isUnitLeader = hasRole("unit_leader");

  const fetchData = async () => {
    try {
      const res = await supabaseFetchWithTimeout<any>(
        supabase
          .from("approvals")
          .select("*, employees(name, unit_id)")
          .order("created_at", { ascending: false })
      );
      
      if (res.error) throw res.error;

      let data = res.data ?? [];

      // Unit leader hanya melihat pengajuan dari anggota unitnya sendiri
      if (isUnitLeader && !isAdminOrHr && employee?.unit_id) {
        data = data.filter((a: any) => a.employees?.unit_id === employee.unit_id);
      }

      setApprovals(data);
    } catch (err) {
      console.error("Approvals: Fetch error", err);
      toast.error("Gagal memuat data persetujuan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleApprove = async (id: string, currentStatus: string) => {
    if (!user) return;
    const updates: Record<string, any> = {};

    if (currentStatus === "pending" && isUnitLeader && !isAdminOrHr) {
      // Level 1: Kepala Unit menyetujui pengajuan yang masih pending
      updates.status = "approved_unit_leader";
      updates.approved_by_unit_leader = user.id;
    } else if (isAdminOrHr) {
      // Level 2: HR atau Super Admin bisa menyetujui di semua status aktif
      updates.status = "approved_hr";
      updates.approved_by_hr = user.id;
    } else {
      toast.error("Anda tidak memiliki wewenang untuk menyetujui pengajuan ini.");
      return;
    }

    const { error } = await supabase.from("approvals").update(updates).eq("id", id);
    if (error) { toast.error("Gagal menyetujui"); return; }
    toast.success("Pengajuan disetujui");
    fetchData();
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase.from("approvals").update({ status: "rejected" }).eq("id", id);
    if (error) { toast.error("Gagal menolak"); return; }
    toast.success("Pengajuan ditolak");
    fetchData();
  };

  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Persetujuan</h1>
          {isUnitLeader && !isAdminOrHr && (
            <p className="text-sm text-muted-foreground mt-0.5">Pengajuan dari anggota unit Anda</p>
          )}
        </div>
      </div>

      <ApprovalInboxTable 
        approvals={approvals}
        loading={loading}
        isAdminOrHr={isAdminOrHr}
        isUnitLeader={isUnitLeader}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </DashboardLayout>
  );
}

