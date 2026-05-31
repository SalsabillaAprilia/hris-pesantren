import type { Tables } from "@/integrations/supabase/types";

export type Employee = Tables<"employees"> & { 
  units?: { name: string } | null;
  positions?: { id: string; name: string } | null;
  shifts?: { name: string; start_time: string; end_time: string } | null;
  position_id?: string | null;
  role?: string;
};
