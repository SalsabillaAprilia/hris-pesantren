import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { supabaseFetchWithTimeout } from "@/utils/supabase-fetch";
import { ApprovalInboxTable } from "@/components/approvals/ApprovalInboxTable";
import { supabase } from "@/integrations/supabase/client";

export default function Approvals() {
  const { user, isAdminOrHr, hasRole } = useAuth();
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
      setApprovals(res.data ?? []);
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
    let newStatus: string;
    const updates: Record<string, any> = {};

    if (currentStatus === "pending" && isUnitLeader && !isAdminOrHr) {
      newStatus = "approved_unit_leader";
      updates.approved_by_unit_leader = user.id;
      updates.status = newStatus;
    } else if ((currentStatus === "pending" || currentStatus === "approved_unit_leader") && isAdminOrHr) {
      newStatus = "approved_hr";
      updates.approved_by_hr = user.id;
      updates.status = newStatus;
    } else {
      newStatus = "approved_unit_leader";
      updates.approved_by_unit_leader = user.id;
      updates.status = newStatus;
    }

    const { error } = await supabase.from("approvals").update(updates).eq("id", id);
    if (error) { toast.error("Gagal menyetujui"); return; }
    toast.success("Disetujui");
    fetchData();
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase.from("approvals").update({ status: "rejected" }).eq("id", id);
    if (error) { toast.error("Gagal menolak"); return; }
    toast.success("Ditolak");
    fetchData();
  };

  return (
    <DashboardLayout>
      <div className="page-header">
        <h1 className="page-title">Persetujuan</h1>
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
