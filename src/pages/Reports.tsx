import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function Reports() {
  return (
    <DashboardLayout>
      <div className="page-header">
        <h1 className="page-title">Laporan</h1>
        <p className="page-description">Laporan dan analitik organisasi</p>
      </div>
      <Card className="stat-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Segera Hadir
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Fitur laporan sedang dalam pengembangan. Laporan kehadiran, KPI, dan ringkasan karyawan akan tersedia di sini.
          </p>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
