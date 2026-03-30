import type { Tables } from "@/integrations/supabase/types";

export type Employee = Tables<"employees"> & { 
  units?: { name: string } | null; 
  role?: string;
  // Field tambahan dari SQL
  employee_id_number?: string;
  gender?: string;
  nationality?: string;
  birth_date?: string;
  birth_place?: string;
  religion?: string;
  last_education?: string;
  address?: string;
  contract_end_date?: string;
  // Field baru sesi ini
  marital_status?: string;
  identity_card_type?: string;
  identity_card_number?: string;
  whatsapp_number?: string;
  address_domicile?: string;
  education_level?: string;
  education_institution?: string;
  education_major?: string;
  attachment_url?: string;
};
