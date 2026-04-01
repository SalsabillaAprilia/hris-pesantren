import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Filter, X, Briefcase, User as UserIcon, GraduationCap } from "lucide-react";

interface EmployeeFilterDrawerProps {
  filters: any;
  setFilters: (filters: any) => void;
  units: any[];
  hasActiveFilters: boolean;
  onReset: () => void;
}

export function EmployeeFilterDrawer({
  filters,
  setFilters,
  units,
  hasActiveFilters,
  onReset
}: EmployeeFilterDrawerProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="h-9 text-xs gap-2 shadow-sm border-primary/20 hover:border-primary/50 transition-all">
          <Filter className="h-3.5 w-3.5 text-primary" />
          Filter
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-1 px-1.5 h-5 min-w-5 flex items-center justify-center bg-primary text-primary-foreground font-bold">
              {Object.values(filters).filter(v => v !== "all").length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[350px] sm:w-[450px] flex flex-col p-0 shadow-2xl border-l-0">
        <SheetHeader className="border-b p-6 bg-primary/5">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl font-bold flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              Filter Karyawan
            </SheetTitle>
          </div>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto px-6 py-2">
          <div className="grid gap-8 py-6 pb-24">
            {/* Kategori: Struktur & Jabatan */}
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest bg-primary/5 p-2 rounded-md">
                <Briefcase className="h-4 w-4" />
                <span>Struktur & Jabatan</span>
              </div>
              <div className="grid gap-5 pl-2">
                <div className="space-y-2.5">
                  <Label className="text-sm text-muted-foreground/90 font-bold tracking-wider">Unit Kerja</Label>
                  <Select value={filters.unit_id} onValueChange={(v) => setFilters({ ...filters, unit_id: v })}>
                    <SelectTrigger className="h-10 text-sm text-slate-900 border-muted-foreground/20 focus:ring-primary/20"><SelectValue placeholder="Semua Unit" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-sm">Semua Unit</SelectItem>
                      {units.map(u => <SelectItem key={u.id} value={u.id} className="text-sm">{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2.5">
                  <Label className="text-sm text-muted-foreground/90 font-bold tracking-wider">Jabatan</Label>
                  <Select value={filters.position} onValueChange={(v) => setFilters({ ...filters, position: v })}>
                    <SelectTrigger className="h-10 text-sm text-slate-900 border-muted-foreground/20 focus:ring-primary/20"><SelectValue placeholder="Semua Jabatan" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-sm">Semua Jabatan</SelectItem>
                      <SelectItem value="Guru" className="text-sm">Guru</SelectItem>
                      <SelectItem value="Staf" className="text-sm">Staf</SelectItem>
                      <SelectItem value="Kepala Unit" className="text-sm">Kepala Unit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Kategori: Status & Masa Kerja */}
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest bg-primary/5 p-2 rounded-md">
                <UserIcon className="h-4 w-4" />
                <span>Status & Masa Kerja</span>
              </div>
              <div className="grid gap-5 pl-2">
                <div className="space-y-2.5">
                  <Label className="text-sm text-muted-foreground/90 font-bold tracking-wider">Status Karyawan</Label>
                  <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                    <SelectTrigger className="h-10 text-sm text-slate-900 border-muted-foreground/20 focus:ring-primary/20"><SelectValue placeholder="Semua Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-sm">Semua Status</SelectItem>
                      <SelectItem value="active" className="text-sm">Aktif</SelectItem>
                      <SelectItem value="inactive" className="text-sm">Nonaktif</SelectItem>
                      <SelectItem value="on_leave" className="text-sm">Cuti</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2.5">
                  <Label className="text-sm text-muted-foreground/90 font-bold tracking-wider">Masa Kerja</Label>
                  <Select value={filters.tenure} onValueChange={(v) => setFilters({ ...filters, tenure: v })}>
                    <SelectTrigger className="h-10 text-sm text-slate-900 border-muted-foreground/20 focus:ring-primary/20"><SelectValue placeholder="Semua Masa Kerja" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-sm">Semua Masa Kerja</SelectItem>
                      <SelectItem value="< 1" className="text-sm">&lt; 1 Tahun</SelectItem>
                      <SelectItem value="1-3" className="text-sm">1 - 3 Tahun</SelectItem>
                      <SelectItem value="3-5" className="text-sm">3 - 5 Tahun</SelectItem>
                      <SelectItem value="> 5" className="text-sm">&gt; 5 Tahun</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest bg-primary/5 p-2 rounded-md">
                <GraduationCap className="h-4 w-4" />
                <span>Biodata & Pendidikan</span>
              </div>
              <div className="grid gap-5 pl-2">
                <div className="space-y-2.5">
                  <Label className="text-sm text-muted-foreground/90 font-bold tracking-wider">Jenjang Pendidikan</Label>
                  <Select value={filters.education} onValueChange={(v) => setFilters({ ...filters, education: v })}>
                    <SelectTrigger className="h-10 text-sm text-slate-900 border-muted-foreground/20 focus:ring-primary/20"><SelectValue placeholder="Semua Jenjang" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-sm">Semua Jenjang</SelectItem>
                      <SelectItem value="SMA/SMK" className="text-sm">SMA/SMK</SelectItem>
                      <SelectItem value="D3" className="text-sm">D1-D3</SelectItem>
                      <SelectItem value="S1" className="text-sm">S1</SelectItem>
                      <SelectItem value="S2" className="text-sm">S2</SelectItem>
                      <SelectItem value="S3" className="text-sm">S3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2.5">
                  <Label className="text-sm text-muted-foreground/90 font-bold tracking-wider">Jenis Kelamin</Label>
                  <Select value={filters.gender} onValueChange={(v) => setFilters({ ...filters, gender: v })}>
                    <SelectTrigger className="h-10 text-sm text-slate-900 border-muted-foreground/20 focus:ring-primary/20"><SelectValue placeholder="Semua Gender" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-sm">Semua Jenis Kelamin</SelectItem>
                      <SelectItem value="Laki-laki" className="text-sm">Laki-laki</SelectItem>
                      <SelectItem value="Perempuan" className="text-sm">Perempuan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2.5">
                  <Label className="text-sm text-muted-foreground/90 font-bold tracking-wider">Agama</Label>
                  <Select value={filters.religion} onValueChange={(v) => setFilters({ ...filters, religion: v })}>
                    <SelectTrigger className="h-10 text-sm text-slate-900 border-muted-foreground/20 focus:ring-primary/20"><SelectValue placeholder="Semua Agama" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-sm">Semua Agama</SelectItem>
                      <SelectItem value="Islam" className="text-sm">Islam</SelectItem>
                      <SelectItem value="Kristen" className="text-sm">Kristen</SelectItem>
                      <SelectItem value="Katolik" className="text-sm">Katolik</SelectItem>
                      <SelectItem value="Hindu" className="text-sm">Hindu</SelectItem>
                      <SelectItem value="Buddha" className="text-sm">Buddha</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <SheetFooter className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t flex flex-row gap-3">
          <Button variant="outline" onClick={onReset} className="flex-1 hover:bg-destructive/5 hover:text-destructive text-muted-foreground transition-all">
            Hapus Filter
          </Button>
          <SheetClose asChild>
            <Button className="flex-1 bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all font-semibold">
              Tampilkan Hasil
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
