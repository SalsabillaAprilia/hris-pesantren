import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDown, FileText, Eye, LucideIcon } from "lucide-react";

interface ReportCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
  count?: number;
  countLabel?: string;
  onPreview: () => void;
  onExportCSV: () => void;
  onExportPDF: () => void;
  loading?: boolean;
}

export function ReportCard({
  title, description, icon: Icon, iconColor, count, countLabel,
  onPreview, onExportCSV, onExportPDF, loading,
}: ReportCardProps) {
  return (
    <Card className="bg-card rounded-xl border shadow-sm hover:shadow-md transition-all group flex flex-col h-full">
      <CardHeader className="p-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-xl ${iconColor} shrink-0 shadow-sm`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-foreground">{title}</CardTitle>
            </div>
          </div>
          {count !== undefined && (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-md border whitespace-nowrap text-[hsl(232,59%,21%)] bg-[hsl(232,59%,96%)] border-[hsl(232,59%,90%)] mt-1">
              {loading ? "..." : count} {countLabel}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0 mt-auto">
        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={onPreview} disabled={loading}
            className="flex-1 gap-1.5 h-9 text-xs bg-white/50 shadow-sm border-primary/20 font-medium hover:border-primary/40 hover:bg-primary/5 hover:text-primary">
            <Eye className="h-4 w-4 text-primary" /> Preview
          </Button>
          <Button variant="outline" size="sm" onClick={onExportCSV} disabled={loading}
            className="flex-1 gap-1.5 h-9 text-xs bg-white/50 shadow-sm border-emerald-300 font-medium text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800">
            <FileDown className="h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={onExportPDF} disabled={loading}
            className="flex-1 gap-1.5 h-9 text-xs bg-white/50 shadow-sm border-rose-300 font-medium text-rose-600 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-800">
            <FileText className="h-4 w-4" /> PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
