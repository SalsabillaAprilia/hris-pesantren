import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useInstansiFilter } from "@/hooks/useInstansiFilter";
import { toast } from "sonner";
import { supabaseFetchWithTimeout } from "@/utils/supabase-fetch";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MonthPicker } from "@/components/ui/month-picker";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, X, ChevronLeft, ChevronRight, Filter, FileText, MessageSquare, AlertCircle, Tag, Calendar, Paperclip, ClipboardCheck, User } from "lucide-react";
import { format } from "date-fns";
import { DetailHeader, DetailSection, DetailItem } from "@/components/ui/detail-layout";
import { id } from "date-fns/locale";
import { useTerminology } from "@/hooks/useTerminology";
import { generateLeaveAttendanceRecords, rollbackLeaveAttendanceRecords } from "@/utils/attendance-generator";
import { formatError } from "@/utils/error-handler";
import { ApprovalDetailModal } from "@/components/approvals/ApprovalDetailModal";

// Global memory cache untuk Stale-While-Revalidate lintas navigasi halaman.
// Memungkinkan data langsung tampil tanpa loading saat user pindah-pindah menu.
let globalApprovalsCache: any[] | null = null;

export default function Approvals() {
  const { user, employee, isAdminOrHr, isSuperAdmin, isHr, hasRole } = useAuth();
  const { term } = useTerminology();
  

  const [isScrolled, setIsScrolled] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLTableSectionElement>(null);

  const { effectiveInstansiId } = useInstansiFilter();
  const [approvals, setApprovals] = useState<any[]>(globalApprovalsCache || []);
  const [loading, setLoading] = useState(globalApprovalsCache === null);

  // Jika cache sudah ada, kita anggap bukan first fetch lagi.
  // Pemuatan ulang akan berjalan diam-diam di background.
  const isFirstFetch = useRef(globalApprovalsCache === null);

  // Filter States
  const [activeTab, setActiveTab] = useState("menunggu");
  const [typeFilter, setTypeFilter] = useState("Semua");
  const [selectedMonth, setSelectedMonth] = useState<string>(
    format(new Date(), "yyyy-MM")
  );

  // UI States
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(null);
  
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<any>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);

  const isUnitLeader = hasRole("unit_leader");
  // Super admin hanya read-only
  const isReadOnly = isSuperAdmin;

  // Derive can action logic untuk detail modal
  const selectedSubmitterRole = selectedDetail?.employees?.role;
  const selectedCanAction = selectedDetail && !isReadOnly && 
    ((isUnitLeader && selectedDetail.employees?.unit_id === employee?.unit_id && selectedSubmitterRole !== "unit_leader") || 
     (isHr && selectedSubmitterRole === "unit_leader")) &&
    selectedDetail.status === "pending";



  // isMounted ref: mencegah request dari komponen yang sudah di-navigate
  // memperbarui state atau memunculkan toast di halaman lain.
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const recalculateSticky = () => {
    const mainEl = document.querySelector('main');
    if (!mainEl || !scrollContainerRef.current || !headerRef.current) return;

    const rect = scrollContainerRef.current.getBoundingClientRect();
    const stickThreshold = Math.max(0, mainEl.getBoundingClientRect().top);
    
    let finalOffset = 0;
    if (rect.top < stickThreshold) {
      const maxOffset = rect.height - 44; 
      const offset = Math.min(stickThreshold - rect.top, maxOffset);
      finalOffset = Math.max(0, offset);
    }
    
    headerRef.current.style.setProperty('--sticky-offset', `${finalOffset}px`);
    if (finalOffset > 0) {
      headerRef.current.classList.add('[&_th]:shadow-sm');
    } else {
      headerRef.current.classList.remove('[&_th]:shadow-sm');
    }
  };

  useEffect(() => {
    const mainEl = document.querySelector('main');
    if (!mainEl) return;

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          recalculateSticky();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    window.addEventListener('resize', handleScroll);
    
    handleScroll();
    
    return () => {
      window.removeEventListener('scroll', handleScroll, { capture: true });
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(recalculateSticky, 50);
    return () => clearTimeout(timer);
  }, [approvals, activeTab]);

  const handleHorizontalScroll = () => {
    if (scrollContainerRef.current) {
      const scrolled = scrollContainerRef.current.scrollLeft > 2;
      if (scrolled !== isScrolled) {
        setIsScrolled(scrolled);
      }
    }
  };

  const fetchData = useCallback(async () => {
    if (isFirstFetch.current) setLoading(true);

    let finalData: any[] = [];
    let finalCount = 0;

    try {
      let q = supabase
        .from("approvals")
        .select("*, employees!approvals_employee_id_fkey!inner(name, unit_id, user_id, avatar_url, units!employees_unit_id_fkey(name))", { count: 'exact' });

      if (effectiveInstansiId) q = (q as any).eq("instansi_id", effectiveInstansiId);
      if (isUnitLeader && !isAdminOrHr && employee?.unit_id) q = q.eq("employees.unit_id", employee.unit_id);
      if (activeTab === "menunggu") q = q.eq("status", "pending");
      else q = q.in("status", ["approved_hr", "approved_unit_leader", "rejected"]);

      if (typeFilter !== "Semua") {
        const reverseMap: Record<string, string> = { "Cuti": "leave", "Izin": "permission", "Lembur": "overtime", "Sakit": "sick", "WFA / WFH": "wfa" };
        if (reverseMap[typeFilter]) q = q.eq("type", reverseMap[typeFilter] as any);
      }

      if (activeTab === "riwayat" && selectedMonth) {
        // Asumsi format selectedMonth adalah YYYY-MM
        const startOfMonth = `${selectedMonth}-01`;
        // Hack simpel mencari tanggal terakhir di bulan itu
        const [year, month] = selectedMonth.split("-");
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const endOfMonth = `${selectedMonth}-${lastDay}`;
        
        // Filter berdasarkan start_date pengajuan
        q = q.gte("start_date", startOfMonth).lte("start_date", endOfMonth);
      }

      q = q.order("created_at", { ascending: false });

      const res = await supabaseFetchWithTimeout<any>(q);
      if (res.error && res.error.code !== "PGRST116") {
        throw res.error;
      }

      let rawData = res.data ?? [];
      
      // Fetch user_roles untuk cek role pengaju secara paralel
      if (rawData.length > 0) {
        const userIds = [...new Set(rawData.map((a: any) => a.employees?.user_id).filter(Boolean))];
        if (userIds.length > 0) {
          const { data: rolesData } = await supabaseFetchWithTimeout<any>(
            supabase.from("user_roles").select("user_id, role").in("user_id", userIds as string[])
          );
          const rolesMap = new Map();
          (rolesData ?? []).forEach((r: any) => {
            if (!rolesMap.has(r.user_id)) rolesMap.set(r.user_id, []);
            rolesMap.get(r.user_id).push(r.role);
          });
          rawData = rawData.map((a: any) => {
            const roles = rolesMap.get(a.employees?.user_id) || ["employee"];
            const submitterRole = roles.includes("unit_leader") ? "unit_leader" : (roles.includes("employee") ? "employee" : roles[0]);
            return {
              ...a,
              employees: {
                ...a.employees,
                role: submitterRole
              }
            };
          });

          if (activeTab === "menunggu") {
            rawData = rawData.filter((a: any) => {
              if (isSuperAdmin) return true;
              
              const submitterRole = a.employees?.role;
              const isFromMyUnit = a.employees?.unit_id === employee?.unit_id;
              
              const canSeeAsLeader = isUnitLeader && isFromMyUnit && submitterRole !== "unit_leader";
              const canSeeAsHr = isHr && submitterRole === "unit_leader";
              
              return canSeeAsLeader || canSeeAsHr;
            });
          }
        }
      }

      finalData = rawData;
      finalCount = res.count ?? 0;


    } catch (err: any) {
      console.error("Approvals: Fetch error", err);
      if (isMounted.current) toast.error(formatError(err, "Gagal memuat data Pengajuan"));
    } finally {
      if (isMounted.current) {
        globalApprovalsCache = finalData;
        
        setApprovals(finalData);
        setLoading(false);
        isFirstFetch.current = false;
      }
    }
  }, [activeTab, typeFilter, selectedMonth, effectiveInstansiId, isUnitLeader, isAdminOrHr, isHr, employee?.unit_id]);

  useEffect(() => {
    fetchData();
    window.addEventListener('app_data_updated', fetchData);
    return () => window.removeEventListener('app_data_updated', fetchData);
  }, [fetchData]);



  const handleApprove = async (id: string) => {
    if (!user) return;
    const approval = approvals.find(a => a.id === id);
    if (!approval) return;

    setIsProcessing(true);
    try {
      const { data: empData, error: empErr } = await supabase.from("employees").select("shift_id").eq("id", approval.employee_id).single();
      if (empErr) throw empErr;

      if (!empData?.shift_id) {
        toast.error("Karyawan belum memiliki jadwal shift. Tentukan shift di menu Karyawan terlebih dahulu.");
        setIsProcessing(false);
        return;
      }

      const { data: shiftData } = await supabase.from("work_shifts").select("*").eq("id", empData.shift_id).single();
      const { data: holidaysData } = await supabase.from("national_holidays").select("date").or(`instansi_id.eq.${approval.instansi_id},instansi_id.is.null`);
      const holidayDates = holidaysData ? holidaysData.map(h => h.date) : [];

      const newStatus = isAdminOrHr ? "approved_hr" : "approved_unit_leader";
      const { error } = await supabase.from("approvals")
        .update({ status: newStatus })
        .eq("id", id);
      
      if (error) throw error;

      await generateLeaveAttendanceRecords(approval, shiftData, holidayDates);

      toast.success("Pengajuan disetujui");
      setDetailModalOpen(false);
      
      // Invalidasi cache agar tab update dengan benar
      globalApprovalsCache = null;
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(formatError(err, "Gagal menyetujui pengajuan"));
    } finally {
      setIsProcessing(false);
    }
  };

  const openRejectModal = (id: string) => {
    setSelectedApprovalId(id);
    setRejectReason("");
    setRejectModalOpen(true);
  };

  const openDetailModal = (approval: any) => {
    setSelectedDetail(approval);
    setDetailModalOpen(true);
  };

  const submitReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApprovalId) return;
    if (!rejectReason.trim()) {
      toast.error("Alasan penolakan wajib diisi");
      return;
    }

    const approval = approvals.find(a => a.id === selectedApprovalId);

    setIsProcessing(true);
    try {
      const { error } = await supabase.from("approvals")
        .update({ status: "rejected", reject_reason: rejectReason })
        .eq("id", selectedApprovalId);
      
      if (error) throw error;

      if (approval) {
        await rollbackLeaveAttendanceRecords(approval);
      }

      toast.success("Pengajuan ditolak");
      setRejectModalOpen(false);
      setDetailModalOpen(false);
      
      // Invalidasi cache agar tab update dengan benar
      globalApprovalsCache = null;
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error(formatError(err, "Gagal menolak pengajuan"));
    } finally {
      setIsProcessing(false);
    }
  };

  // UI Helpers
  const mapTypeLabel = (dbType: string) => {
    const map: Record<string, string> = { leave: "Cuti", permission: "Izin", overtime: "Lembur", sick: "Sakit", wfa: "WFA / WFH" };
    return map[dbType] ?? dbType;
  };

  const statusBadge = (status: string) => {
    switch(status) {
      case "approved_hr":
      case "approved_unit_leader":
        return <span className="text-[11px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap text-[hsl(142,45%,25%)] bg-[hsl(142,45%,96%)] border-[hsl(142,45%,90%)]">Disetujui</span>;
      case "pending":
        return <span className="text-[11px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap text-[hsl(38,55%,30%)] bg-[hsl(38,55%,94%)] border-[hsl(38,55%,88%)]">Menunggu</span>;
      case "rejected":
        return <span className="text-[11px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap text-[hsl(0,55%,35%)] bg-[hsl(0,55%,96%)] border-[hsl(0,55%,90%)]">Ditolak</span>;
      default:
        return <span className="text-[11px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap text-[hsl(232,59%,21%)] bg-[hsl(232,59%,96%)] border-[hsl(232,59%,90%)]">{status}</span>;
    }
  };

  return (
    <DashboardLayout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Approval</h1>
        </div>

        {/* Tombol filter di kanan — persis seperti Attendance */}
        <div className="flex gap-2 shrink-0">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[170px] h-9 bg-white/50 shadow-sm border-primary/20 text-sm font-medium transition-all transform active:scale-95 hover:bg-accent hover:text-accent-foreground hover:border-accent">
              <SelectValue placeholder="Semua Pengajuan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Semua">Semua Pengajuan</SelectItem>
              <SelectItem value="Cuti">Cuti</SelectItem>
              <SelectItem value="Izin">Izin</SelectItem>
              <SelectItem value="Sakit">Sakit</SelectItem>
              <SelectItem value="Lembur">Lembur</SelectItem>
              <SelectItem value="WFA / WFH">WFA / WFH</SelectItem>
            </SelectContent>
          </Select>

          {activeTab === "riwayat" && (
            <MonthPicker 
              value={selectedMonth} 
              onChange={setSelectedMonth}
              className="bg-white/50 border-primary/20 text-sm font-medium h-9 w-fit pr-4"
            />
          )}
        </div>
      </div>

      {/* Tabs full-width langsung di bawah header — persis seperti Attendance */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 mb-3 bg-muted/50 h-9 rounded-lg">
          <TabsTrigger value="menunggu" className="text-xs">Menunggu Persetujuan</TabsTrigger>
          <TabsTrigger value="riwayat" className="text-xs">Riwayat Persetujuan</TabsTrigger>
        </TabsList>

        <div className="relative border rounded-md bg-white flex flex-col">
          <div 
            ref={scrollContainerRef}
            onScroll={handleHorizontalScroll}
            className="overflow-x-auto overflow-y-visible flex-1 h-auto relative"
          >
            <Table className="w-full caption-bottom text-sm relative border-separate border-spacing-0 min-w-[900px]">
              <TableHeader 
                ref={headerRef}
                className="z-20 transition-none [&_th]:sticky [&_th]:top-[var(--sticky-offset)] [&_th:not(.sticky)]:z-30 [&_th:not(.sticky)]:bg-muted"
                style={{ "--sticky-offset": "0px" } as React.CSSProperties}
              >
                <TableRow className="border-none hover:bg-transparent text-muted-foreground">
                  <TableHead className={`sticky left-0 z-[40] bg-muted transition-none w-[50px] min-w-[50px] text-center font-semibold whitespace-nowrap px-4 align-middle ${isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.3)]' : 'shadow-none'}`}>
                    No.
                  </TableHead>
                  <TableHead className={`sticky left-[50px] z-[40] bg-muted transition-none w-[180px] min-w-[180px] font-semibold text-left whitespace-nowrap px-4 align-middle ${isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.3)]' : 'shadow-none'}`}>
                    Nama
                  </TableHead>
                  <TableHead className="min-w-[150px] font-semibold text-center whitespace-nowrap px-4 align-middle">{term}</TableHead>
                  <TableHead className="font-semibold text-left whitespace-nowrap px-4 align-middle">Pengajuan</TableHead>
                  <TableHead className="font-semibold text-left whitespace-nowrap px-4 align-middle">Tanggal Kegiatan</TableHead>
                  <TableHead className="w-[250px] font-semibold text-left whitespace-nowrap px-4 align-middle">Alasan</TableHead>
                  <TableHead className="font-semibold text-center whitespace-nowrap px-4 align-middle">Status</TableHead>
                  {activeTab === "menunggu" && !isReadOnly && <TableHead className="font-semibold text-center w-[120px] whitespace-nowrap px-4 align-middle">Keputusan</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-sm text-muted-foreground">
                      Memuat data pengajuan...
                    </TableCell>
                  </TableRow>
                ) : approvals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-sm text-muted-foreground">
                      Tidak ada data pengajuan.
                    </TableCell>
                  </TableRow>
                ) : (
                  approvals.map((a, index) => {
                    const submitterRole = a.employees?.role;
                    const canAction = !isReadOnly && (
                      (isUnitLeader && a.employees?.unit_id === employee?.unit_id && submitterRole !== "unit_leader") ||
                      (isHr && submitterRole === "unit_leader")
                    );

                    return (
                      <TableRow 
                        key={a.id} 
                        className="cursor-pointer hover:bg-muted/50 transition-colors h-11 group border-b border-gray-200 text-sm"
                        onClick={() => openDetailModal(a)}
                      >
                        <TableCell className={`sticky left-0 z-[20] bg-white text-center transition-all duration-75 w-[50px] max-w-[50px] min-w-[50px] group-hover:bg-[#f8fafc] py-1.5 px-4 align-middle text-slate-500 ${isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.25)]' : 'shadow-none'}`}>
                          {index + 1}
                        </TableCell>
                        <TableCell className={`sticky left-[50px] z-[20] bg-white font-medium text-slate-900 transition-all duration-75 w-[180px] max-w-[180px] min-w-[180px] group-hover:bg-[#f8fafc] py-1.5 px-4 align-middle truncate text-left ${isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.25)]' : 'shadow-none'}`} title={a.employees?.name ?? "—"}>
                          {a.employees?.name ?? "—"}
                        </TableCell>
                        <TableCell className="text-center text-slate-900 max-w-[150px] truncate py-1.5 px-4 align-middle" title={a.employees?.units?.name ?? "—"}>
                          {a.employees?.units?.name ?? "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-1.5 px-4 align-middle text-left text-slate-900 font-medium">
                          {mapTypeLabel(a.type)}
                        </TableCell>
                        <TableCell className="text-slate-900 whitespace-nowrap py-1.5 px-4 align-middle text-left">
                          {a.type === "overtime" || (a.start_date === a.end_date) 
                            ? format(new Date(a.start_date), "dd/MM/yyyy", { locale: id })
                            : `${format(new Date(a.start_date), "dd/MM/yyyy", { locale: id })} - ${format(new Date(a.end_date), "dd/MM/yyyy", { locale: id })}`}
                        </TableCell>
                        <TableCell className="max-w-[200px] py-1.5 px-4 align-middle text-left">
                          <p className="truncate text-slate-700">{a.reason}</p>
                        </TableCell>
                        <TableCell className="text-center py-1.5 px-4 align-middle">{statusBadge(a.status)}</TableCell>
                        {activeTab === "menunggu" && !isReadOnly && (
                          <TableCell className="text-center py-1.5 px-4 align-middle">
                            {canAction ? (
                              <div className="flex justify-center gap-1">
                                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); handleApprove(a.id); }} disabled={isProcessing} className="h-8 w-8 hover:bg-emerald-50 hover:text-emerald-600" title="Setujui">
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openRejectModal(a.id); }} disabled={isProcessing} className="h-8 w-8 hover:bg-red-50 hover:text-red-600" title="Tolak">
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>


        </Tabs>

      {/* Reject Modal */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-[450px] shadow-2xl border-none">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900">Tolak Pengajuan</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitReject}>
            <div className="space-y-4 pt-2 text-slate-600">
              <p className="text-sm">
                Apakah Anda yakin ingin menolak pengajuan ini?
              </p>
              <div className="space-y-2 p-4 bg-destructive/5 rounded-lg border border-destructive/10">
                <Label htmlFor="reason" className="text-xs font-semibold text-muted-foreground">
                  Mohon berikan alasan penolakan yang jelas.
                </Label>
                <Textarea 
                  id="reason"
                  placeholder="Alasan penolakan..." 
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="min-h-[80px] text-sm border-destructive/20 focus-visible:ring-destructive bg-white resize-none shadow-sm"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-6">
              <Button type="button" variant="outline" onClick={() => setRejectModalOpen(false)} disabled={isProcessing} className="h-10 min-w-[120px] text-sm font-semibold">
                Batal
              </Button>
              <Button type="submit" variant="destructive" disabled={isProcessing || rejectReason.trim() === ""} className="h-10 min-w-[120px] text-sm bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold shadow-lg shadow-destructive/20 transition-all disabled:opacity-50 disabled:shadow-none">
                {isProcessing ? "Memproses..." : "Tolak Pengajuan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ApprovalDetailModal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        approval={selectedDetail}
        onStatusChange={(id, status) => {
          if (status === "approved") {
            handleApprove(id);
          } else {
            setDetailModalOpen(false);
            setTimeout(() => openRejectModal(id), 100);
          }
        }}
        loading={isProcessing}
        readOnly={!selectedCanAction}
      />
    </DashboardLayout>
  );
}
