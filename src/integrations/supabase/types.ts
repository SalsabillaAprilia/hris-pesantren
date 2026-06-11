export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      institutions: {
        Row: {
          id: string
          name: string
          logo_url: string | null
          primary_color: string | null
          created_at: string
          organization_term?: string | null
          is_active?: boolean | null
        }
        Insert: {
          id?: string
          name: string
          logo_url?: string | null
          primary_color?: string | null
          created_at?: string
          organization_term?: string | null
          is_active?: boolean | null
        }
        Update: {
          id?: string
          name?: string
          logo_url?: string | null
          primary_color?: string | null
          created_at?: string
          organization_term?: string | null
          is_active?: boolean | null
        }
        Relationships: []
      }
      agenda_reports: {
        Row: {
          id: string
          employee_id: string
          instansi_id: string
          start_date: string
          end_date: string
          status: Database["public"]["Enums"]["report_status"]
          manager_notes: string | null
          approved_by: string | null
          approved_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          instansi_id: string
          start_date: string
          end_date: string
          status?: Database["public"]["Enums"]["report_status"]
          manager_notes?: string | null
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          instansi_id?: string
          start_date?: string
          end_date?: string
          status?: Database["public"]["Enums"]["report_status"]
          manager_notes?: string | null
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_reports_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_items: {
        Row: {
          id: string
          report_id: string
          date: string
          duration_minutes: number
          activity: string
          created_at: string
        }
        Insert: {
          id?: string
          report_id: string
          date: string
          duration_minutes: number
          activity: string
          created_at?: string
        }
        Update: {
          id?: string
          report_id?: string
          date?: string
          duration_minutes?: number
          activity?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_items_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "agenda_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          approved_by_hr: string | null
          approved_by_unit_leader: string | null
          created_at: string
          employee_id: string
          end_date: string
          hr_notes: string | null
          id: string
          reason: string
            reject_reason: string | null
            start_date: string
          start_time: string | null
          end_time: string | null
          status: Database["public"]["Enums"]["approval_status"]
          type: Database["public"]["Enums"]["approval_type"]
          unit_leader_notes: string | null
          updated_at: string
          instansi_id: string | null
          attachment_url: string | null
        }
        Insert: {
          approved_by_hr?: string | null
          approved_by_unit_leader?: string | null
          created_at?: string
          employee_id: string
          end_date: string
          hr_notes?: string | null
          id?: string
          reason: string
          reject_reason?: string | null
          start_date: string
          start_time?: string | null
          end_time?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          type: Database["public"]["Enums"]["approval_type"]
          unit_leader_notes?: string | null
          updated_at?: string
          instansi_id?: string | null
          attachment_url?: string | null
        }
        Update: {
          approved_by_hr?: string | null
          approved_by_unit_leader?: string | null
          created_at?: string
          employee_id?: string
          end_date?: string
          hr_notes?: string | null
          id?: string
          reason?: string
            reject_reason?: string | null
            start_date?: string
          start_time?: string | null
          end_time?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          type?: Database["public"]["Enums"]["approval_type"]
          unit_leader_notes?: string | null
          updated_at?: string
          instansi_id?: string | null
          attachment_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approvals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          check_in: string | null
          check_in_location: string | null
          check_in_method: string | null
          check_out: string | null
          check_out_location: string | null
          check_out_method: string | null
          created_at: string
          daily_status: string | null
          date: string
          employee_id: string
          id: string
          late_minutes: number | null
          notes: string | null
          overtime_minutes: number | null
          early_leave_minutes: number | null
          selfie_url: string | null
          admin_notes: string | null
          instansi_id: string | null
        }
        Insert: {
          check_in?: string | null
          check_in_location?: string | null
          check_in_method?: string | null
          check_out?: string | null
          check_out_location?: string | null
          check_out_method?: string | null
          created_at?: string
          daily_status?: string | null
          date?: string
          employee_id: string
          id?: string
          late_minutes?: number | null
          notes?: string | null
          overtime_minutes?: number | null
          early_leave_minutes?: number | null
          selfie_url?: string | null
          admin_notes?: string | null
          instansi_id?: string | null
        }
        Update: {
          check_in?: string | null
          check_in_location?: string | null
          check_in_method?: string | null
          check_out?: string | null
          check_out_location?: string | null
          check_out_method?: string | null
          created_at?: string
          daily_status?: string | null
          date?: string
          employee_id?: string
          id?: string
          late_minutes?: number | null
          notes?: string | null
          overtime_minutes?: number | null
          early_leave_minutes?: number | null
          selfie_url?: string | null
          admin_notes?: string | null
          instansi_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          join_date: string
          name: string
          position: string | null
          shift_id: string | null
          status: Database["public"]["Enums"]["employee_status"]
          unit_id: string | null
          updated_at: string
          user_id: string
          employee_id_number: string | null
          gender: string | null
          nationality: string | null
          birth_date: string | null
          birth_place: string | null
          religion: string | null
          marital_status: string | null
          identity_card_type: string | null
          identity_card_number: string | null
          whatsapp_number: string | null
          address: string | null
          address_domicile: string | null
          education_level: string | null
          education_institution: string | null
          education_major: string | null
          contract_end_date: string | null
          attachment_url: string | null
          instansi_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id?: string
          join_date?: string
          name: string
          position?: string | null
          shift_id?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          unit_id?: string | null
          updated_at?: string
          user_id: string
          employee_id_number?: string | null
          gender?: string | null
          nationality?: string | null
          birth_date?: string | null
          birth_place?: string | null
          religion?: string | null
          marital_status?: string | null
          identity_card_type?: string | null
          identity_card_number?: string | null
          whatsapp_number?: string | null
          address?: string | null
          address_domicile?: string | null
          education_level?: string | null
          education_institution?: string | null
          education_major?: string | null
          contract_end_date?: string | null
          attachment_url?: string | null
          instansi_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          join_date?: string
          name?: string
          position?: string | null
          shift_id?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          unit_id?: string | null
          updated_at?: string
          user_id?: string
          employee_id_number?: string | null
          gender?: string | null
          nationality?: string | null
          birth_date?: string | null
          birth_place?: string | null
          religion?: string | null
          marital_status?: string | null
          identity_card_type?: string | null
          identity_card_number?: string | null
          whatsapp_number?: string | null
          address?: string | null
          address_domicile?: string | null
          education_level?: string | null
          education_institution?: string | null
          education_major?: string | null
          contract_end_date?: string | null
          attachment_url?: string | null
          instansi_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_evaluations: {
        Row: {
          created_at: string
          employee_id: string
          evaluator_id: string
          id: string
          start_date: string | null
          end_date: string | null
          status: Database["public"]["Enums"]["kpi_evaluation_status"]
          qualitative_feedback: string | null
          template_id: string
          total_score: number | null
          updated_at: string
          instansi_id: string | null
        }
        Insert: {
          created_at?: string
          employee_id: string
          evaluator_id: string
          id?: string
          start_date?: string | null
          end_date?: string | null
          status?: Database["public"]["Enums"]["kpi_evaluation_status"]
          qualitative_feedback?: string | null
          template_id: string
          total_score?: number | null
          updated_at?: string
          instansi_id?: string | null
        }
        Update: {
          created_at?: string
          employee_id?: string
          evaluator_id?: string
          id?: string
          start_date?: string | null
          end_date?: string | null
          status?: Database["public"]["Enums"]["kpi_evaluation_status"]
          qualitative_feedback?: string | null
          template_id?: string
          total_score?: number | null
          updated_at?: string
          instansi_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_evaluations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_evaluations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "kpi_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_indicators: {
        Row: {
          created_at: string
          id: string
          name: string
          description: string | null
          template_id: string
          weight: number
          instansi_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          description?: string | null
          template_id: string
          weight: number
          instansi_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          description?: string | null
          template_id?: string
          weight?: number
          instansi_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_indicators_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "kpi_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_scores: {
        Row: {
          created_at: string
          evaluation_id: string
          id: string
          indicator_id: string
          score: number
          instansi_id: string | null
        }
        Insert: {
          created_at?: string
          evaluation_id: string
          id?: string
          indicator_id: string
          score: number
          instansi_id?: string | null
        }
        Update: {
          created_at?: string
          evaluation_id?: string
          id?: string
          indicator_id?: string
          score?: number
          instansi_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_scores_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "kpi_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_scores_indicator_id_fkey"
            columns: ["indicator_id"]
            isOneToOne: false
            referencedRelation: "kpi_indicators"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_templates: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          scale: number
          threshold_sangat_baik: number
          threshold_baik: number
          threshold_cukup: number
          updated_at: string
          instansi_id: string | null
          is_active: boolean
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          scale?: number
          threshold_sangat_baik?: number
          threshold_baik?: number
          threshold_cukup?: number
          updated_at?: string
          instansi_id?: string | null
          is_active?: boolean
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          scale?: number
          threshold_sangat_baik?: number
          threshold_baik?: number
          threshold_cukup?: number
          updated_at?: string
          instansi_id?: string | null
          is_active?: boolean
        }
        Relationships: []
      }
      national_holidays: {
        Row: {
          id: string
          date: string
          description: string
          created_at: string
          instansi_id: string | null
        }
        Insert: {
          id?: string
          date: string
          description: string
          created_at?: string
          instansi_id?: string | null
        }
        Update: {
          id?: string
          date?: string
          description?: string
          created_at?: string
          instansi_id?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_by: string
          assigned_to: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
          instansi_id: string | null
        }
        Insert: {
          assigned_by: string
          assigned_to: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
          instansi_id?: string | null
        }
        Update: {
          assigned_by?: string
          assigned_to?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
          instansi_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          instansi_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          instansi_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          instansi_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          instansi_id: string | null
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          instansi_id?: string | null
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          instansi_id?: string | null
        }
        Relationships: []
      }
      work_shifts: {
        Row: {
          created_at: string
          end_time: string
          id: string
          late_tolerance_minutes: number
          name: string
          start_time: string
          updated_at: string
          instansi_id: string | null
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          late_tolerance_minutes?: number
          name: string
          start_time: string
          updated_at?: string
          instansi_id?: string | null
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          late_tolerance_minutes?: number
          name?: string
          start_time?: string
          updated_at?: string
          instansi_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_employee_unit: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_hr: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      report_status: "DRAFT" | "SUBMITTED" | "REVISION_REQUESTED" | "APPROVED"
      app_role: "super_admin" | "hr" | "unit_leader" | "employee" | "director"
      approval_status: "pending" | "approved_unit_leader" | "approved_hr" | "rejected"
      approval_type: "leave" | "permission" | "overtime" | "sick" | "wfa"
      employee_status: "active" | "inactive" | "on_leave"
      kpi_evaluation_status: "TODO" | "DRAFT" | "SUBMITTED"
      task_status: "todo" | "in_progress" | "done" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      agenda_status: ["todo", "on_progress", "done", "cancelled"],
      app_role: ["super_admin", "hr", "unit_leader", "employee"],
      approval_status: ["pending", "approved", "rejected"],
      approval_type: ["leave", "permission", "overtime", "sick", "wfa"],
      employee_status: ["active", "inactive", "on_leave"],
      kpi_evaluation_status: ["TODO", "DRAFT", "SUBMITTED"],
      task_status: ["todo", "in_progress", "pending_review", "done", "cancelled"],
    },
  },
} as const


