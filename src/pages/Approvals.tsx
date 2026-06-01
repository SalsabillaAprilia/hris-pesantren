import { useEffect, useState, useRef, useCallback } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, X, ChevronLeft, ChevronRight, Filter, FileText, MessageSquare, AlertCircle, User as UserIcon } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { useTerminology } from "@/hooks/useTerminology";
import { generateLeaveAttendanceRecords, rollbackLeaveAttendanceRecords } from "@/utils/attendance-generator";

const PAGE_SIZE = 10;

// Global memory cache untuk Stale-While-Revalidate lintas navigasi halaman.
// Memungkinkan data langsung tampil tanpa loading saat user pindah-pindah menu.
let globalApprovalsCache: any[] | null = null;
let globalApprovalsCount = 0;

export default function Approvals() {
  const { user, employee, isAdminOrHr, isSuperAdmin, hasRole } = useAuth();
  const { term } = useTerminology();
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleHorizontalScroll = () => {
    if (scrollContainerRef.current) {
      const scrolled = scrollContainerRef.current.scrollLeft > 2;
      if (scrolled !== isScrolled) {
        setIsScrolled(scrolled);
      }
    }
  };
  const { effectiveInstansiId } = useInstansiFilter();
  const [approvals, setApprovals] = useState<any[]>(globalApprovalsCache || []);
  const [loading, setLoading] = useState(globalApprovalsCache === null);

  // Jika cache sudah ada, kita anggap bukan first fetch lagi.
  // Pemuatan ulang akan berjalan diam-diam di background.
  const isFirstFetch = useRef(globalApprovalsCache === null);

  // Pagination & Filter States
  const [activeTab, setActiveTab] = useState("menunggu");
  const [typeFilter, setTypeFilter] = useState("Semua");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Advanced Date Filters
  const [createdAtStart, setCreatedAtStart] = useState("");
  const [createdAtEnd, setCreatedAtEnd] = useState("");
  const [eventDateStart, setEventDateStart] = useState("");
  const [eventDateEnd, setEventDateEnd] = useState("");

  // UI States
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(null);
  
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<any>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);

  const isUnitLeader = hasRole("unit_leader");
  const isDirector = hasRole("director");
  const isReadOnly = isSuperAdmin || isDirector;

  const selectedCanAction = selectedDetail && !isReadOnly && 
    ((isUnitLeader && selectedDetail.employees?.unit_id === employee?.unit_id) || isAdminOrHr) &&
    selectedDetail.status === "pending";

  // Reset page ke 1 setiap kali filter berubah
  useEffect(() => {
    setPage(1);
  }, [activeTab, typeFilter, effectiveInstansiId, createdAtStart, createdAtEnd, eventDateStart, eventDateEnd]);

  // isMounted ref: mencegah request dari komponen yang sudah di-navigate
  // memperbarui state atau memunculkan toast di halaman lain.
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const fetchData = useCallback(async () => {
    if (isFirstFetch.current) setLoading(true);

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let finalData: any[] = [];
    let finalCount = 0;

    try {
      let q = supabase
        .from("approvals")
        .select("*, employees!approvals_employee_id_fkey!inner(name, unit_id, units!employees_unit_id_fkey(name))", { count: 'exact' });

      if (effectiveInstansiId) q = (q as any).eq("instansi_id", effectiveInstansiId);
      if (isUnitLeader && !isAdminOrHr && employee?.unit_id) q = q.eq("employees.unit_id", employee.unit_id);
      if (activeTab === "menunggu") q = q.eq("status", "pending");
      else q = q.in("status", ["approved_hr", "approved_unit_leader", "rejected"]);

      if (typeFilter !== "Semua") {
        const reverseMap: Record<string, string> = { "Cuti": "leave", "Izin": "permission", "Lembur": "overtime", "Sakit": "sick", "WFA": "wfa" };
        if (reverseMap[typeFilter]) q = q.eq("type", reverseMap[typeFilter] as any);
      }

      if (createdAtStart) q = q.gte("created_at", `${createdAtStart}T00:00:00`);
      if (createdAtEnd)   q = q.lte("created_at", `${createdAtEnd}T23:59:59`);
      if (eventDateStart) q = q.gte("end_date", eventDateStart);
      if (eventDateEnd)   q = q.lte("start_date", eventDateEnd);

      q = q.order("created_at", { ascending: false }).range(from, to);

      const res = await supabaseFetchWithTimeout<any>(q);
      if (res.error && res.error.code !== "PGRST116") {
        throw res.error;
      }

      finalData = res.data ?? [];
      finalCount = res.count ?? 0;
    } catch (err: any) {
      console.error("Approvals: Fetch error", err);
      if (isMounted.current) toast.error("Gagal memuat data Pengajuan");
    } finally {
      if (isMounted.current) {
        // Simpan ke cache global agar navigasi berikutnya instan
        globalApprovalsCache = finalData;
        globalApprovalsCount = finalCount;
        
        setApprovals(finalData);
        setTotalCount(finalCount);
        setLoading(false);
        isFirstFetch.current = false;
      }
    }
  }, [page, activeTab, typeFilter, effectiveInstansiId, createdAtStart, createdAtEnd, eventDateStart, eventDateEnd, isUnitLeader, isAdminOrHr, employee?.unit_id]);

  useEffect(() => {
    fetchData();
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
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Gagal menyetujui pengajuan");
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
      fetchData();
    } catch (err) {
      console.error(err);
      toast.error("Gagal menolak pengajuan");
    } finally {
      setIsProcessing(false);
    }
  };

  // UI Helpers
  const mapTypeLabel = (dbType: string) => {
    const map: Record<string, string> = { leave: "Cuti", permission: "Izin", overtime: "Lembur", sick: "Sakit", wfa: "WFA" };
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
      <div className="page-header mb-6">
        <h1 className="page-title text-2xl font-bold">Dasbor Persetujuan</h1>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-[400px]">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="menunggu">Menunggu</TabsTrigger>
            <TabsTrigger value="riwayat">Riwayat</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2 bg-white">
                <Filter className="h-4 w-4" /> Filter Lanjutan
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4" align="end">
              <div className="space-y-4">
                <h4 className="font-semibold text-sm">Filter Tanggal</h4>
                
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Tanggal Pengajuan Dibuat</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="date" value={createdAtStart} onChange={e => setCreatedAtStart(e.target.value)} className="h-8 text-xs" />
                    <Input type="date" value={createdAtEnd} onChange={e => setCreatedAtEnd(e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Tanggal Kegiatan</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="date" value={eventDateStart} onChange={e => setEventDateStart(e.target.value)} className="h-8 text-xs" />
                    <Input type="date" value={eventDateEnd} onChange={e => setEventDateEnd(e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => { setCreatedAtStart(""); setCreatedAtEnd(""); setEventDateStart(""); setEventDateEnd(""); }}>
                    Reset Filter
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <div className="flex items-center gap-2 border-l pl-3 ml-1">
            <Label className="text-sm font-medium text-slate-600 whitespace-nowrap">Jenis:</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px] bg-white">
                <SelectValue placeholder="Semua Jenis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Semua">Semua Pengajuan</SelectItem>
                <SelectItem value="Izin">Izin</SelectItem>
                <SelectItem value="Cuti">Cuti</SelectItem>
                <SelectItem value="Sakit">Sakit</SelectItem>
                <SelectItem value="Lembur">Lembur</SelectItem>
                <SelectItem value="WFA">WFA</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="relative border rounded-md bg-white flex flex-col">
        <div 
          ref={scrollContainerRef}
          onScroll={handleHorizontalScroll}
          className="overflow-x-auto overflow-y-visible flex-1 h-auto relative"
        >
          <table className="w-full caption-bottom text-sm relative border-separate border-spacing-0 min-w-[900px]">
            <thead className="bg-muted">
              <tr className="border-none hover:bg-transparent text-muted-foreground">
                <th 
                  className={`sticky left-0 z-[40] bg-muted transition-none w-[50px] min-w-[50px] text-center font-semibold whitespace-nowrap border-b border-gray-200 h-11 px-4 align-middle
                    ${isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.3)]' : 'shadow-none'}`}
                >
                  No.
                </th>
                <th 
                  className={`sticky left-[50px] z-[40] bg-muted transition-none w-[180px] min-w-[180px] font-semibold text-left whitespace-nowrap border-b border-gray-200 px-4 align-middle
                    ${isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.3)]' : 'shadow-none'}`}
                >
                  Nama
                </th>
                <th className="min-w-[150px] font-semibold text-center whitespace-nowrap border-b border-gray-200 px-4 align-middle">{term}</th>
                <th className="font-semibold text-left whitespace-nowrap border-b border-gray-200 px-4 align-middle">Jenis</th>
                <th className="font-semibold text-left whitespace-nowrap border-b border-gray-200 px-4 align-middle">Tanggal Kegiatan</th>
                <th className="w-[250px] font-semibold text-left whitespace-nowrap border-b border-gray-200 px-4 align-middle">Alasan</th>
                <th className="font-semibold text-center whitespace-nowrap border-b border-gray-200 px-4 align-middle">Status</th>
                {activeTab === "menunggu" && !isReadOnly && <th className="font-semibold text-center w-[120px] whitespace-nowrap border-b border-gray-200 px-4 align-middle">Aksi</th>}
              </tr>
            </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-10 text-muted-foreground align-middle">Memuat data...</td></tr>
            ) : approvals.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-10 text-muted-foreground align-middle">Tidak ada data pengajuan.</td></tr>
            ) : (
              approvals.map((a, index) => {
                const canAction = !isReadOnly && ((isUnitLeader && a.employees?.unit_id === employee?.unit_id) || isAdminOrHr);
                return (
                  <tr 
                    key={a.id} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors h-11 group border-b border-gray-200 text-sm"
                    onClick={() => openDetailModal(a)}
                  >
                    <td 
                      className={`sticky left-0 z-[20] bg-white text-center transition-all duration-75 w-[50px] max-w-[50px] min-w-[50px] group-hover:bg-[#f1f5f9] py-1.5 px-4 align-middle text-slate-500 border-b border-gray-200
                        ${isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.25)]' : 'shadow-none'}`}
                    >
                      {(page - 1) * PAGE_SIZE + index + 1}
                    </td>
                    <td 
                      className={`sticky left-[50px] z-[20] bg-white font-medium text-slate-900 transition-all duration-75 w-[180px] max-w-[180px] min-w-[180px] group-hover:bg-[#f1f5f9] py-1.5 px-4 align-middle truncate text-left border-b border-gray-200
                        ${isScrolled ? 'shadow-[inset_-1px_0_0_0_#94a3b8,8px_0_12px_-4px_rgba(0,0,0,0.25)]' : 'shadow-none'}`}
                      title={a.employees?.name ?? "—"}
                    >
                      {a.employees?.name ?? "—"}
                    </td>
                    <td className="text-center text-slate-900 max-w-[150px] truncate py-1.5 px-4 align-middle border-b border-gray-200" title={a.employees?.units?.name ?? "—"}>
                      {a.employees?.units?.name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap py-1.5 px-4 align-middle text-left text-slate-900 border-b border-gray-200 font-medium">
                      {mapTypeLabel(a.type)}
                    </td>
                    <td className="text-slate-900 whitespace-nowrap py-1.5 px-4 align-middle text-left border-b border-gray-200">
                      {a.type === "overtime" || (a.start_date === a.end_date) 
                        ? format(new Date(a.start_date), "dd/MM/yy", { locale: id })
                        : `${format(new Date(a.start_date), "dd/MM/yy", { locale: id })} - ${format(new Date(a.end_date), "dd/MM/yy", { locale: id })}`}
                    </td>
                    <td className="max-w-[200px] py-1.5 px-4 align-middle text-left border-b border-gray-200">
                      <p className="truncate text-slate-700">{a.reason}</p>
                    </td>
                    <td className="text-center py-1.5 px-4 align-middle border-b border-gray-200">{statusBadge(a.status)}</td>
                    {activeTab === "menunggu" && !isReadOnly && (
                      <td className="text-center py-1.5 px-4 align-middle border-b border-gray-200">
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
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between mt-4 bg-white p-3 rounded-xl border shadow-sm">
          <p className="text-sm text-slate-500">
            Menampilkan <span className="font-medium text-slate-900">{Math.min((page - 1) * PAGE_SIZE + 1, totalCount)}</span> - <span className="font-medium text-slate-900">{Math.min(page * PAGE_SIZE, totalCount)}</span> dari total <span className="font-medium text-slate-900">{totalCount}</span> data
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1 || loading} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Prev
            </Button>
            <Button variant="outline" size="sm" disabled={page * PAGE_SIZE >= totalCount || loading} onClick={() => setPage(p => p + 1)}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

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

      {/* Detail Modal */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden shadow-2xl border-none flex flex-col max-h-[90vh]">
          <DialogHeader className="p-6 border-b bg-primary/5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-white shadow-md">
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">
                    {selectedDetail?.employees?.name?.charAt(0) ?? "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <DialogTitle className="text-2xl font-bold tracking-tight">{selectedDetail?.employees?.name ?? "—"}</DialogTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{selectedDetail?.employees?.units?.name ?? "—"}</span>
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30"></div>
                    {selectedDetail && statusBadge(selectedDetail.status)}
                  </div>
                </div>
              </div>

              {selectedCanAction && (
                <div className="flex items-center gap-2 pr-6">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => handleApprove(selectedDetail.id)} 
                    disabled={isProcessing} 
                    className="gap-1.5 font-semibold bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 hover:border-emerald-200 shadow-none"
                  >
                    <Check className="h-3.5 w-3.5" /> Setujui
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => {
                      setDetailModalOpen(false);
                      setTimeout(() => openRejectModal(selectedDetail.id), 100);
                    }} 
                    disabled={isProcessing} 
                    className="gap-1.5 font-semibold bg-red-50 border-red-100 text-red-600 hover:bg-red-100 hover:text-red-700 hover:border-red-200 shadow-none"
                  >
                    <X className="h-3.5 w-3.5" /> Tolak
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto p-8">
            {selectedDetail && (
              <div className="space-y-10">
                {/* Seksi Detail Pengajuan */}
                <section>
                  <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider mb-6">
                    <div className="h-4 w-1 bg-primary rounded-full"></div>
                    <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Informasi Pengajuan</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 pl-3 border-l-2 border-muted/50 py-1">
                    <div className="space-y-1">
                      <span className="text-sm font-bold text-muted-foreground/90">Jenis Pengajuan</span>
                      <p className="text-sm font-semibold text-slate-900">{mapTypeLabel(selectedDetail.type)}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-sm font-bold text-muted-foreground/90">Tanggal Kegiatan</span>
                      <p className="text-sm font-semibold text-slate-900">
                        {selectedDetail.type === "overtime" || (selectedDetail.start_date === selectedDetail.end_date) 
                          ? format(new Date(selectedDetail.start_date), "dd MMMM yyyy", { locale: id })
                          : `${format(new Date(selectedDetail.start_date), "dd MMMM yyyy", { locale: id })} - ${format(new Date(selectedDetail.end_date), "dd MMMM yyyy", { locale: id })}`}
                        {selectedDetail.type === "overtime" && selectedDetail.start_time && (
                          <span className="text-slate-500 font-normal ml-1">({selectedDetail.start_time.slice(0,5)} - {selectedDetail.end_time?.slice(0,5)})</span>
                        )}
                      </p>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <span className="text-sm font-bold text-muted-foreground/90">Tanggal Pengajuan</span>
                      <p className="text-sm font-semibold text-slate-900">{format(new Date(selectedDetail.created_at || new Date()), "dd MMMM yyyy, HH:mm", { locale: id })}</p>
                    </div>
                  </div>
                </section>

                {/* Seksi Alasan / Keterangan */}
                <section>
                  <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider mb-6">
                    <div className="h-4 w-1 bg-primary rounded-full"></div>
                    <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Alasan Pengajuan</span>
                  </div>
                  <div className="pl-3 py-1">
                    <p className="text-sm bg-slate-50/50 p-4 rounded-xl border border-slate-200/60 text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {selectedDetail.reason}
                    </p>
                  </div>
                </section>

                {/* Seksi Lampiran */}
                {selectedDetail.attachment_url && (
                  <section>
                    <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider mb-6">
                      <div className="h-4 w-1 bg-primary rounded-full"></div>
                      <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Lampiran Pendukung</span>
                    </div>
                    <div className="pl-3 py-1">
                      <a 
                        href={selectedDetail.attachment_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 rounded-lg text-sm font-medium border border-blue-200 transition-colors"
                      >
                        <FileText className="h-4 w-4" />
                        Buka Surat / Dokumen Lampiran
                      </a>
                    </div>
                  </section>
                )}

                {/* Seksi Alasan Penolakan */}
                {selectedDetail.status === "rejected" && selectedDetail.reject_reason && (
                  <section>
                    <div className="flex items-center gap-2 text-red-600 font-bold text-xs uppercase tracking-wider mb-6">
                      <div className="h-4 w-1 bg-red-600 rounded-full"></div>
                      <span className="flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> Alasan Penolakan</span>
                    </div>
                    <div className="pl-3 py-1">
                      <p className="text-sm bg-red-50/50 p-4 rounded-xl border border-red-100/60 text-red-700 whitespace-pre-wrap leading-relaxed">
                        {selectedDetail.reject_reason}
                      </p>
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}
