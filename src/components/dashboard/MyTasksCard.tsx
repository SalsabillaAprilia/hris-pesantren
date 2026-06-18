import { useMemo } from "react";
import { format, parseISO, isPast, isToday } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListTodo, Circle, CircleDot, CheckCircle2, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { TASK_STATUS_MAP, getTaskStatusBadgeClass } from "@/utils/task-mapping";

interface MyTasksCardProps {
  tasks: any[];
  loading: boolean;
}

const statusConfig: Record<string, { label: string; icon: typeof Circle; class: string; iconColor: string }> = {
  todo: {
    label: "Belum",
    icon: Circle,
    class: "text-[hsl(232,59%,21%)] bg-[hsl(232,59%,96%)] border-[hsl(232,59%,90%)]",
    iconColor: "text-muted-foreground",
  },
  in_progress: {
    label: "Proses",
    icon: CircleDot,
    class: "text-[hsl(38,55%,30%)] bg-[hsl(38,55%,94%)] border-[hsl(38,55%,88%)]",
    iconColor: "text-[hsl(38,80%,45%)]",
  },
  done: {
    label: "Selesai",
    icon: CheckCircle2,
    class: "text-[hsl(142,45%,25%)] bg-[hsl(142,45%,96%)] border-[hsl(142,45%,90%)]",
    iconColor: "text-[hsl(142,45%,35%)]",
  },
  revision: {
    label: "Direvisi",
    icon: AlertCircle,
    class: "text-[hsl(0,55%,35%)] bg-[hsl(0,55%,96%)] border-[hsl(0,55%,90%)]",
    iconColor: "text-[hsl(0,55%,45%)]",
  },
};

export function MyTasksCard({ tasks, loading }: MyTasksCardProps) {
  const navigate = useNavigate();

  const activeTasks = useMemo(() => {
    return tasks
      .filter((t) => t.status === "todo" || t.status === "in_progress" || t.status === "revision")
      .sort((a, b) => {
        // Sort by due date (soonest first), null dates last
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      })
      .slice(0, 5)
      .map((t) => {
        const isOverdue = t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date));
        const isDueToday = t.due_date && isToday(parseISO(t.due_date));
        return {
          id: t.id,
          title: t.title,
          status: t.status,
          dueDate: t.due_date
            ? format(parseISO(t.due_date), "dd MMM yyyy", { locale: localeId })
            : null,
          isOverdue,
          isDueToday,
        };
      });
  }, [tasks]);

  const totalActive = tasks.filter((t) => t.status === "todo" || t.status === "in_progress" || t.status === "revision").length;

  return (
    <Card className="bg-card rounded-xl border shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-primary" />
            Tugas Aktif
          </CardTitle>
          {totalActive > 0 && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap text-[hsl(232,59%,21%)] bg-[hsl(232,59%,96%)] border-[hsl(232,59%,90%)]">
              {totalActive} tugas
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
            Memuat data...
          </div>
        ) : activeTasks.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground text-sm">
            Tidak ada tugas aktif
          </div>
        ) : (
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {activeTasks.map((task) => {
              const cfg = statusConfig[task.status] || statusConfig.todo;
              const StatusIcon = cfg.icon;
              return (
                <div
                  key={task.id}
                  onClick={() => navigate("/tasks")}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <StatusIcon className={`h-4 w-4 shrink-0 ${cfg.iconColor}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                    {task.dueDate && (
                      <p
                        className={`text-[11px] ${
                          task.isOverdue
                            ? "text-[hsl(0,55%,45%)] font-semibold"
                            : task.isDueToday
                            ? "text-[hsl(38,80%,40%)] font-semibold"
                            : "text-muted-foreground"
                        }`}
                      >
                        {task.isOverdue
                          ? `⚠ Terlambat — ${task.dueDate}`
                          : task.isDueToday
                          ? `📌 Hari ini`
                          : `Tenggat: ${task.dueDate}`}
                      </p>
                    )}
                  </div>
                  <span
                    className={getTaskStatusBadgeClass(task.status)}
                  >
                    {TASK_STATUS_MAP[task.status]?.label || task.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
