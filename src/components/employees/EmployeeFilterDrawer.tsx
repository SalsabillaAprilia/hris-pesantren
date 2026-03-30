import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Filter, X, Briefcase, User as UserIcon, Phone } from "lucide-react";

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
        <Button variant="outline" className="gap-2 shadow-sm border-primary/20 hover:border-primary/50 transition-all">
          <Filter className="h-4 w-4 text-primary" />
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
                  <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Unit Kerja</Label>
                  <Select value={filters.unit_id} onValueChange={(v) => setFilters({ ...filters, unit_id: v })}>
                    <SelectTrigger className="h-10 border-muted-foreground/20 focus:ring-primary/20"><SelectValue placeholder="Semua Unit" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Unit</SelectItem>
                      {units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2.5">
                  <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Jabatan</Label>
                  <Select value={filters.position} onValueChange={(v) => setFilters({ ...filters, position: v })}>
                    <SelectTrigger className="h-10 border-muted-foreground/20 focus:ring-primary/20"><SelectValue placeholder="Semua Jabatan" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Jabatan</SelectItem>
                      <SelectItem value="Guru">Guru</SelectItem>
                      <SelectItem value="Staf">Staf</SelectItem>
                      <SelectItem value="Kepala Unit">Kepala Unit</SelectItem>
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
                  <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Status Keaktifan</Label>
                  <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                    <SelectTrigger className="h-10 border-muted-foreground/20 focus:ring-primary/20"><SelectValue placeholder="Semua Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Status</SelectItem>
                      <SelectItem value="active">Aktif</SelectItem>
                      <SelectItem value="inactive">Nonaktif</SelectItem>
                      <SelectItem value="on_leave">Cuti</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2.5">
                  <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Masa Kerja (Tahun)</Label>
                  <Select value={filters.tenure} onValueChange={(v) => setFilters({ ...filters, tenure: v })}>
                    <SelectTrigger className="h-10 border-muted-foreground/20 focus:ring-primary/20"><SelectValue placeholder="Semua Masa Kerja" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Masa Kerja</SelectItem>
                      <SelectItem value="< 1">&lt; 1 Tahun</SelectItem>
                      <SelectItem value="1-3">1 - 3 Tahun</SelectItem>
                      <SelectItem value="3-5">3 - 5 Tahun</SelectItem>
                      <SelectItem value="> 5">&gt; 5 Tahun</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Kategori: Lainnya */}
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-widest bg-primary/5 p-2 rounded-md">
                <Phone className="h-4 w-4" />
                <span>Biodata & Pendidikan</span>
              </div>
              <div className="grid gap-5 pl-2">
                <div className="space-y-2.5">
                  <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Jenis Kelamin</Label>
                  <Select value={filters.gender} onValueChange={(v) => setFilters({ ...filters, gender: v })}>
                    <SelectTrigger className="h-10 border-muted-foreground/20 focus:ring-primary/20"><SelectValue placeholder="Semua Gender" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Gender</SelectItem>
                      <SelectItem value="Laki-laki">Laki-laki</SelectItem>
                      <SelectItem value="Perempuan">Perempuan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2.5">
                  <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Pendidikan (Jenjang)</Label>
                  <Select value={filters.education} onValueChange={(v) => setFilters({ ...filters, education: v })}>
                    <SelectTrigger className="h-10 border-muted-foreground/20 focus:ring-primary/20"><SelectValue placeholder="Semua Jenjang" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Jenjang</SelectItem>
                      <SelectItem value="SMA/SMK">SMA/SMK</SelectItem>
                      <SelectItem value="D3">D3</SelectItem>
                      <SelectItem value="S1">S1</SelectItem>
                      <SelectItem value="S2">S2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2.5">
                  <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Agama</Label>
                  <Select value={filters.religion} onValueChange={(v) => setFilters({ ...filters, religion: v })}>
                    <SelectTrigger className="h-10 border-muted-foreground/20 focus:ring-primary/20"><SelectValue placeholder="Semua Agama" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Agama</SelectItem>
                      <SelectItem value="Islam">Islam</SelectItem>
                      <SelectItem value="Kristen">Kristen</SelectItem>
                      <SelectItem value="Katolik">Katolik</SelectItem>
                      <SelectItem value="Hindu">Hindu</SelectItem>
                      <SelectItem value="Buddha">Buddha</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <SheetFooter className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t flex flex-row gap-3">
          <Button variant="ghost" onClick={onReset} className="flex-1 hover:bg-destructive/5 hover:text-destructive text-muted-foreground transition-all">
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
