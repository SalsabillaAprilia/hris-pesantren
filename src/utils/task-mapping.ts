const baseClass = "text-[11px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap";

export const TASK_STATUS_MAP: Record<string, { label: string; colorClass: string }> = {
  todo: {
    label: "Antrean",
    colorClass: "text-[hsl(232,59%,21%)] bg-[hsl(232,59%,96%)] border-[hsl(232,59%,90%)]",
  },
  in_progress: {
    label: "Sedang Dikerjakan",
    colorClass: "text-[hsl(198,55%,25%)] bg-[hsl(198,55%,94%)] border-[hsl(198,55%,88%)]", // Biru muda
  },
  pending_review: {
    label: "Menunggu Review",
    colorClass: "text-[hsl(38,55%,30%)] bg-[hsl(38,55%,94%)] border-[hsl(38,55%,88%)]", // Amber Gold
  },
  done: {
    label: "Selesai",
    colorClass: "text-[hsl(142,45%,25%)] bg-[hsl(142,45%,96%)] border-[hsl(142,45%,90%)]", // Hijau Forest
  },
  cancelled: {
    label: "Dibatalkan",
    colorClass: "text-[hsl(0,55%,35%)] bg-[hsl(0,55%,96%)] border-[hsl(0,55%,90%)]", // Deep Crimson
  },
  revision: {
    label: "Direvisi",
    colorClass: "text-[hsl(0,55%,35%)] bg-[hsl(0,55%,96%)] border-[hsl(0,55%,90%)]", // Deep Crimson
  },
};

export const TASK_PRIORITY_MAP: Record<string, { label: string; colorClass: string }> = {
  Low: {
    label: "Rendah",
    colorClass: "text-slate-600 bg-slate-100 border-slate-200",
  },
  Medium: {
    label: "Sedang",
    colorClass: "text-[hsl(38,55%,30%)] bg-[hsl(38,55%,94%)] border-[hsl(38,55%,88%)]", // Amber Gold
  },
  High: {
    label: "Tinggi",
    colorClass: "text-[hsl(0,55%,35%)] bg-[hsl(0,55%,96%)] border-[hsl(0,55%,90%)]", // Deep Crimson
  },
};

export const getTaskStatusBadgeClass = (status: string) => {
  const config = TASK_STATUS_MAP[status] || { label: status, colorClass: "text-slate-600 bg-slate-100 border-slate-200" };
  return `${baseClass} ${config.colorClass}`;
};

export const getTaskPriorityBadgeClass = (priority: string) => {
  const config = TASK_PRIORITY_MAP[priority] || { label: priority, colorClass: "text-slate-600 bg-slate-100 border-slate-200" };
  return `${baseClass} ${config.colorClass}`;
};
