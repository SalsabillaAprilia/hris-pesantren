import { Badge } from "@/components/ui/badge";

export const calculateMasaKerja = (joinDate: string | null) => {
  if (!joinDate) return "—";
  const start = new Date(joinDate);
  const end = new Date();
  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  if (months < 0) {
    years--;
    months += 12;
  }
  return `${years} thn ${months} bln`;
};

export const getStatusBadge = (status: string) => {
  const variants: Record<string, "default" | "secondary" | "destructive"> = {
    active: "default",
    inactive: "destructive",
    on_leave: "secondary",
  };
  const labels: Record<string, string> = { active: "Aktif", inactive: "Nonaktif", on_leave: "Cuti" };
  
  // Import components inside to satisfy React rendering if needed, 
  // but here we just return the Badge component.
  return (
    <Badge variant={variants[status] ?? "secondary"} className="whitespace-nowrap">
      {labels[status] ?? status}
    </Badge>
  );
};
