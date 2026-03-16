import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, BarChart3, Trash2 } from "lucide-react";

export default function KPI() {
  const { user, isAdminOrHr } = useAuth();
  const [templates, setTemplates] = useState<any[]>([]);
  const [indicators, setIndicators] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");
  const [newIndicators, setNewIndicators] = useState([{ name: "", weight: "" }]);

  const fetchData = async () => {
    const [tRes, iRes] = await Promise.all([
      supabase.from("kpi_templates").select("*").order("created_at", { ascending: false }),
      supabase.from("kpi_indicators").select("*"),
    ]);
    setTemplates(tRes.data ?? []);
    setIndicators(iRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const totalWeight = newIndicators.reduce((sum, i) => sum + (parseFloat(i.weight) || 0), 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      toast.error("Total bobot harus 100%");
      return;
    }

    const { data: template, error } = await supabase
      .from("kpi_templates")
      .insert({ name: templateName, description: templateDesc || null, created_by: user.id })
      .select()
      .single();

    if (error || !template) { toast.error("Gagal: " + error?.message); return; }

    const indicatorInserts = newIndicators.map((i) => ({
      template_id: template.id,
      name: i.name,
      weight: parseFloat(i.weight),
    }));

    await supabase.from("kpi_indicators").insert(indicatorInserts);

    toast.success("Template KPI dibuat");
    setDialogOpen(false);
    setTemplateName("");
    setTemplateDesc("");
    setNewIndicators([{ name: "", weight: "" }]);
    fetchData();
  };

  const addIndicatorRow = () => setNewIndicators([...newIndicators, { name: "", weight: "" }]);
  const removeIndicatorRow = (idx: number) => setNewIndicators(newIndicators.filter((_, i) => i !== idx));
  const updateIndicator = (idx: number, field: string, value: string) => {
    const updated = [...newIndicators];
    (updated[idx] as any)[field] = value;
    setNewIndicators(updated);
  };

  const getIndicators = (templateId: string) => indicators.filter((i) => i.template_id === templateId);

  return (
    <DashboardLayout>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">KPI</h1>
          <p className="page-description">Template dan evaluasi kinerja</p>
        </div>
        {isAdminOrHr && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Buat Template</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Buat Template KPI</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nama Template</Label>
                  <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Deskripsi</Label>
                  <Input value={templateDesc} onChange={(e) => setTemplateDesc(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Indikator</Label>
                  {newIndicators.map((ind, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        placeholder="Nama indikator"
                        value={ind.name}
                        onChange={(e) => updateIndicator(idx, "name", e.target.value)}
                        required
                        className="flex-1"
                      />
                      <Input
                        placeholder="Bobot %"
                        type="number"
                        value={ind.weight}
                        onChange={(e) => updateIndicator(idx, "weight", e.target.value)}
                        required
                        className="w-24"
                        min="1"
                        max="100"
                      />
                      {newIndicators.length > 1 && (
                        <Button type="button" size="icon" variant="ghost" onClick={() => removeIndicatorRow(idx)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addIndicatorRow}>+ Tambah Indikator</Button>
                </div>
                <Button type="submit" className="w-full">Simpan</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <p className="text-muted-foreground col-span-2 text-center py-8">Memuat...</p>
        ) : templates.length === 0 ? (
          <p className="text-muted-foreground col-span-2 text-center py-8">Belum ada template KPI</p>
        ) : (
          templates.map((t) => (
            <Card key={t.id} className="stat-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  {t.name}
                </CardTitle>
                {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Indikator</TableHead>
                      <TableHead className="text-right">Bobot</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getIndicators(t.id).map((ind) => (
                      <TableRow key={ind.id}>
                        <TableCell>{ind.name}</TableCell>
                        <TableCell className="text-right font-medium">{ind.weight}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}
