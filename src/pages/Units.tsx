import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

export default function Units() {
  const [units, setUnits] = useState<(Tables<"units"> & { employeeCount: number })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: unitsData } = await supabase.from("units").select("*").order("name");
      const { data: empData } = await supabase.from("employees").select("unit_id");

      const counts: Record<string, number> = {};
      empData?.forEach((e) => { if (e.unit_id) counts[e.unit_id] = (counts[e.unit_id] || 0) + 1; });

      setUnits((unitsData ?? []).map((u) => ({ ...u, employeeCount: counts[u.id] || 0 })));
      setLoading(false);
    };
    fetch();
  }, []);

  return (
    <DashboardLayout>
      <div className="page-header">
        <h1 className="page-title">Unit</h1>
        <p className="page-description">Unit organisasi pesantren</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {loading ? (
          <p className="text-muted-foreground col-span-3 text-center py-8">Memuat...</p>
        ) : (
          units.map((u) => (
            <Card key={u.id} className="stat-card">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg">{u.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{u.description}</p>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{u.employeeCount}</p>
                <p className="text-sm text-muted-foreground">Karyawan</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}
