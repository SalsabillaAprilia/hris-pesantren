import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ClipboardCheck, FileCheck, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { TASK_STATUS_MAP, getTaskStatusBadgeClass } from "@/utils/task-mapping";

interface PendingTasksCardProps {
  tasks: any[];
  loading: boolean;
  isGlobalMode?: boolean;
}

export function PendingTasksCard({ tasks, loading, isGlobalMode }: PendingTasksCardProps) {
  const navigate = useNavigate();
  // Filter only tasks that are pending_review
  const pendingTasks = tasks.filter(t => t.status === "pending_review");

  return (
    <Card className="bg-card rounded-xl border shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          Menunggu Konfirmasi
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
            Memuat data...
          </div>
        ) : pendingTasks.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm">
            Belum ada tugas menunggu
          </div>
        ) : (
          <div className="space-y-2 max-h-[250px] overflow-y-auto">
            {pendingTasks.map((t) => (
              <div
                key={t.id}
                onClick={() => !isGlobalMode && navigate('/tasks')}
                className={`flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 transition-colors ${
                  !isGlobalMode ? "hover:bg-muted/50 cursor-pointer" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t.employees?.name || "Karyawan"} • Tenggat: {t.due_date ? format(new Date(t.due_date), "dd MMM yyyy", { locale: localeId }) : "Tidak Ada"}
                  </p>
                </div>
                <span className={`shrink-0 ml-3 ${getTaskStatusBadgeClass(t.status)}`}>
                  {TASK_STATUS_MAP[t.status]?.label || t.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
