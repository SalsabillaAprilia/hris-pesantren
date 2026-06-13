


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'super_admin',
    'hr',
    'unit_leader',
    'employee',
    'director'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."approval_status" AS ENUM (
    'pending',
    'approved_unit_leader',
    'approved_hr',
    'rejected',
    'approved'
);


ALTER TYPE "public"."approval_status" OWNER TO "postgres";


CREATE TYPE "public"."approval_type" AS ENUM (
    'leave',
    'permission',
    'overtime',
    'sick',
    'wfa'
);


ALTER TYPE "public"."approval_type" OWNER TO "postgres";


CREATE TYPE "public"."employee_status" AS ENUM (
    'active',
    'inactive',
    'on_leave'
);


ALTER TYPE "public"."employee_status" OWNER TO "postgres";


CREATE TYPE "public"."kpi_evaluation_status" AS ENUM (
    'TODO',
    'DRAFT',
    'SUBMITTED'
);


ALTER TYPE "public"."kpi_evaluation_status" OWNER TO "postgres";


CREATE TYPE "public"."report_status" AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'REVISION_REQUESTED',
    'APPROVED'
);


ALTER TYPE "public"."report_status" OWNER TO "postgres";


CREATE TYPE "public"."task_priority" AS ENUM (
    'Low',
    'Medium',
    'High'
);


ALTER TYPE "public"."task_priority" OWNER TO "postgres";


CREATE TYPE "public"."task_status" AS ENUM (
    'todo',
    'in_progress',
    'pending_review',
    'done',
    'cancelled'
);


ALTER TYPE "public"."task_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_auth_user"("target_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Cek apakah user yang memanggil fungsi ini adalah admin/hr
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('super_admin', 'hr', 'director')
  ) THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya admin yang dapat menghapus akun.';
  END IF;

  -- Hapus dari auth.users
  -- Relasi tabel employees dan user_roles yang menggunakan ON DELETE CASCADE 
  -- akan terhapus otomatis di level database.
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;


ALTER FUNCTION "public"."delete_auth_user"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_employee_complete"("employee_uuid" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Dapatkan ID Autentikasi (user_id) dari karyawan yang akan dihapus
  SELECT user_id INTO target_user_id FROM public.employees WHERE id = employee_uuid;
  
  IF target_user_id IS NOT NULL THEN
    -- Menghapus dari auth.users otomatis akan membersihkan data di 
    -- tabel employees dan user_roles tanpa sisa (berkat ON DELETE CASCADE)
    DELETE FROM auth.users WHERE id = target_user_id;
  END IF;
END;
$$;


ALTER FUNCTION "public"."delete_employee_complete"("employee_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_employee_unit"("_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT unit_id FROM public.employees WHERE user_id = _user_id LIMIT 1
$$;


ALTER FUNCTION "public"."get_employee_unit"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- 1. Masukkan ke tabel employees dengan instansi_id
  INSERT INTO public.employees (user_id, name, email, instansi_id)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), 
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'instansi_id', '')::uuid
  );
  
  -- 2. Masukkan ke tabel user_roles DENGAN instansi_id (Ini yang sebelumnya kurang!)
  INSERT INTO public.user_roles (user_id, role, instansi_id)
  VALUES (
    NEW.id, 
    'employee',
    NULLIF(NEW.raw_user_meta_data->>'instansi_id', '')::uuid
  );
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin_or_hr"("_user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin', 'hr'))
$$;


ALTER FUNCTION "public"."is_admin_or_hr"("_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_absences_for_today"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    today_date date := current_date;
    today_dow integer := extract(isodow from current_date); -- 1: Senin, 7: Minggu
    is_holiday boolean;
    emp record;
BEGIN
    -- Cek libur nasional
    SELECT EXISTS (SELECT 1 FROM national_holidays WHERE date = today_date) INTO is_holiday;
    IF is_holiday THEN
        RETURN; -- Skip karena hari ini libur
    END IF;

    -- Loop semua karyawan (status active) yang shift-nya aktif di hari ini
    FOR emp IN 
        SELECT e.id, e.shift_id 
        FROM employees e
        JOIN work_shifts ws ON e.shift_id = ws.id
        WHERE ws.work_days @> ARRAY[today_dow] AND e.status = 'active'
    LOOP
        -- Cek apakah dia SUDAH ada record absensi di tabel attendance hari ini (baik check-in telat, izin/cuti dsb)
        IF NOT EXISTS (SELECT 1 FROM attendance WHERE employee_id = emp.id AND date = today_date) THEN
            -- Cek apakah dia sedang cuti resmi
            IF NOT EXISTS (
                SELECT 1 FROM approvals 
                WHERE employee_id = emp.id 
                AND status IN ('approved_hr', 'approved_unit_leader') 
                AND today_date >= start_date AND today_date <= end_date
            ) THEN
                -- Insert the absence/mangkir record
                INSERT INTO attendance (
                    employee_id, date, daily_status, notes
                ) VALUES (
                    emp.id, today_date, 'Mangkir', 'Otomatis digenerate sistem (Tutup Absen)'
                );
            END IF;
        END IF;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."mark_absences_for_today"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_employee_unit_leader_role"("target_user_id" "uuid", "new_role" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Pastikan hanya eksekutor yang merupakan Admin atau HR yang bisa menjalankan
  IF NOT public.is_admin_or_hr(auth.uid()) THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya Admin atau HR yang dapat mengubah peran struktural.';
  END IF;

  -- Batasi hanya untuk pergantian unit_leader dan employee
  IF new_role NOT IN ('employee', 'unit_leader') THEN
    RAISE EXCEPTION 'Role tidak valid. Fungsi ini hanya untuk mengatur kepala unit.';
  END IF;

  -- Eksekusi update
  UPDATE public.user_roles
  SET role = new_role::public.app_role
  WHERE user_id = target_user_id;
END;
$$;


ALTER FUNCTION "public"."set_employee_unit_leader_role"("target_user_id" "uuid", "new_role" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."agenda_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "duration_minutes" integer DEFAULT 30 NOT NULL,
    "activity" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_agenda_items_duration" CHECK ((("duration_minutes" >= 5) AND ("duration_minutes" <= 1440)))
);


ALTER TABLE "public"."agenda_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."agenda_items" IS 'Item kegiatan individual dalam laporan mingguan (child).';



CREATE TABLE IF NOT EXISTS "public"."agenda_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "instansi_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "status" "public"."report_status" DEFAULT 'DRAFT'::"public"."report_status" NOT NULL,
    "manager_notes" "text",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_agenda_reports_dates" CHECK (("end_date" >= "start_date"))
);


ALTER TABLE "public"."agenda_reports" OWNER TO "postgres";


COMMENT ON TABLE "public"."agenda_reports" IS 'Laporan agenda mingguan karyawan (parent). Satu baris = satu periode Senin-Minggu.';



CREATE TABLE IF NOT EXISTS "public"."approvals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "type" "public"."approval_type" NOT NULL,
    "status" "public"."approval_status" DEFAULT 'pending'::"public"."approval_status" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "reason" "text" NOT NULL,
    "unit_leader_notes" "text",
    "hr_notes" "text",
    "approved_by_unit_leader" "uuid",
    "approved_by_hr" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "start_time" time without time zone,
    "end_time" time without time zone,
    "instansi_id" "uuid",
    "reject_reason" "text",
    "attachment_url" "text"
);


ALTER TABLE "public"."approvals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "check_in" timestamp with time zone,
    "check_out" timestamp with time zone,
    "selfie_url" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "check_in_location" "text",
    "check_out_location" "text",
    "check_in_method" "text" DEFAULT 'selfie'::"text",
    "check_out_method" "text",
    "late_minutes" integer DEFAULT 0,
    "overtime_minutes" integer DEFAULT 0,
    "daily_status" "text",
    "early_leave_minutes" integer DEFAULT 0,
    "admin_notes" "text",
    "instansi_id" "uuid"
);


ALTER TABLE "public"."attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "unit_id" "uuid",
    "join_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "status" "public"."employee_status" DEFAULT 'active'::"public"."employee_status" NOT NULL,
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "employee_id_number" "text",
    "gender" "text",
    "nationality" "text" DEFAULT 'WNI'::"text",
    "birth_date" "date",
    "birth_place" "text",
    "religion" "text",
    "last_education" "text",
    "address" "text",
    "contract_end_date" "date",
    "marital_status" "text",
    "identity_card_type" "text",
    "identity_card_number" "text",
    "whatsapp_number" "text",
    "address_domicile" "text",
    "education_level" "text",
    "education_institution" "text",
    "education_major" "text",
    "attachment_url" "text",
    "shift_id" "uuid",
    "position_id" "uuid",
    "instansi_id" "uuid"
);


ALTER TABLE "public"."employees" OWNER TO "postgres";


COMMENT ON TABLE "public"."employees" IS 'Table to store detailed employee profiles for HRIS';



CREATE TABLE IF NOT EXISTS "public"."institutions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "logo_url" "text",
    "primary_color" "text" DEFAULT '#1E3A8A'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "organization_term" "text" DEFAULT 'Unit'::"text",
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."institutions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kpi_evaluations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "template_id" "uuid" NOT NULL,
    "evaluator_id" "uuid" NOT NULL,
    "total_score" numeric(5,2),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "instansi_id" "uuid",
    "start_date" "date",
    "end_date" "date",
    "status" "public"."kpi_evaluation_status" DEFAULT 'TODO'::"public"."kpi_evaluation_status" NOT NULL,
    "qualitative_feedback" "text",
    CONSTRAINT "kpi_evaluations_date_range" CHECK ((("end_date" IS NULL) OR ("start_date" IS NULL) OR ("end_date" >= "start_date")))
);


ALTER TABLE "public"."kpi_evaluations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kpi_indicators" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "weight" numeric(5,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "instansi_id" "uuid",
    "description" "text",
    CONSTRAINT "kpi_indicators_weight_check" CHECK ((("weight" > (0)::numeric) AND ("weight" <= (100)::numeric)))
);


ALTER TABLE "public"."kpi_indicators" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kpi_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "evaluation_id" "uuid" NOT NULL,
    "indicator_id" "uuid" NOT NULL,
    "score" numeric(5,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "instansi_id" "uuid",
    CONSTRAINT "kpi_scores_score_check" CHECK ((("score" >= (0)::numeric) AND ("score" <= (100)::numeric)))
);


ALTER TABLE "public"."kpi_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kpi_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "instansi_id" "uuid",
    "scale" integer DEFAULT 100 NOT NULL,
    "threshold_sangat_baik" numeric(5,2) DEFAULT 85 NOT NULL,
    "threshold_baik" numeric(5,2) DEFAULT 70 NOT NULL,
    "threshold_cukup" numeric(5,2) DEFAULT 55 NOT NULL,
    "is_active" boolean DEFAULT true,
    CONSTRAINT "kpi_templates_scale_check" CHECK (("scale" > 0)),
    CONSTRAINT "kpi_templates_threshold_baik_check" CHECK (("threshold_baik" >= (0)::numeric)),
    CONSTRAINT "kpi_templates_threshold_cukup_check" CHECK (("threshold_cukup" >= (0)::numeric)),
    CONSTRAINT "kpi_templates_threshold_sangat_baik_check" CHECK (("threshold_sangat_baik" >= (0)::numeric)),
    CONSTRAINT "kpi_templates_thresholds_order" CHECK ((("threshold_sangat_baik" > "threshold_baik") AND ("threshold_baik" > "threshold_cukup") AND ("threshold_cukup" >= (0)::numeric)))
);


ALTER TABLE "public"."kpi_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."national_holidays" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "description" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "instansi_id" "uuid"
);


ALTER TABLE "public"."national_holidays" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."positions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "instansi_id" "uuid",
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."positions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "assigned_to" "uuid" NOT NULL,
    "assigned_by" "uuid" NOT NULL,
    "due_date" "date",
    "status" "public"."task_status" DEFAULT 'todo'::"public"."task_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "instansi_id" "uuid" NOT NULL,
    "priority" "public"."task_priority" DEFAULT 'Medium'::"public"."task_priority" NOT NULL,
    "checklists" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "kpi_indicator_id" "uuid"
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."units" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "leader_id" "uuid",
    "instansi_id" "uuid",
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."units" OWNER TO "postgres";


COMMENT ON COLUMN "public"."units"."leader_id" IS 'ID Karyawan yang menjabat sebagai Kepala Unit';



CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "instansi_id" "uuid"
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."work_shifts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "late_tolerance_minutes" integer DEFAULT 15 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "work_days" integer[] DEFAULT ARRAY[1, 2, 3, 4, 5],
    "instansi_id" "uuid"
);


ALTER TABLE "public"."work_shifts" OWNER TO "postgres";


ALTER TABLE ONLY "public"."agenda_items"
    ADD CONSTRAINT "agenda_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agenda_reports"
    ADD CONSTRAINT "agenda_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."approvals"
    ADD CONSTRAINT "approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_employee_id_date_key" UNIQUE ("employee_id", "date");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."institutions"
    ADD CONSTRAINT "institutions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kpi_evaluations"
    ADD CONSTRAINT "kpi_evaluations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kpi_indicators"
    ADD CONSTRAINT "kpi_indicators_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kpi_scores"
    ADD CONSTRAINT "kpi_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kpi_templates"
    ADD CONSTRAINT "kpi_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."national_holidays"
    ADD CONSTRAINT "national_holidays_date_key" UNIQUE ("date");



ALTER TABLE ONLY "public"."national_holidays"
    ADD CONSTRAINT "national_holidays_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."units"
    ADD CONSTRAINT "units_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."units"
    ADD CONSTRAINT "units_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agenda_reports"
    ADD CONSTRAINT "uq_agenda_reports_employee_week" UNIQUE ("employee_id", "start_date");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "public"."work_shifts"
    ADD CONSTRAINT "work_shifts_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_agenda_items_date" ON "public"."agenda_items" USING "btree" ("date");



CREATE INDEX "idx_agenda_items_report" ON "public"."agenda_items" USING "btree" ("report_id");



CREATE INDEX "idx_agenda_reports_employee" ON "public"."agenda_reports" USING "btree" ("employee_id");



CREATE INDEX "idx_agenda_reports_instansi" ON "public"."agenda_reports" USING "btree" ("instansi_id");



CREATE INDEX "idx_agenda_reports_start_date" ON "public"."agenda_reports" USING "btree" ("start_date" DESC);



CREATE INDEX "idx_agenda_reports_status" ON "public"."agenda_reports" USING "btree" ("status");



CREATE INDEX "idx_kpi_evaluations_date_range" ON "public"."kpi_evaluations" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_kpi_evaluations_employee_status" ON "public"."kpi_evaluations" USING "btree" ("employee_id", "status");



CREATE INDEX "idx_kpi_evaluations_status" ON "public"."kpi_evaluations" USING "btree" ("status");



CREATE INDEX "idx_tasks_due_date" ON "public"."tasks" USING "btree" ("due_date");



CREATE INDEX "idx_tasks_instansi_id" ON "public"."tasks" USING "btree" ("instansi_id");



CREATE INDEX "idx_tasks_priority" ON "public"."tasks" USING "btree" ("priority");



CREATE INDEX "idx_tasks_status" ON "public"."tasks" USING "btree" ("status");



CREATE OR REPLACE TRIGGER "trg_agenda_reports_updated_at" BEFORE UPDATE ON "public"."agenda_reports" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "update_approvals_updated_at" BEFORE UPDATE ON "public"."approvals" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_employees_updated_at" BEFORE UPDATE ON "public"."employees" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_kpi_evaluations_updated_at" BEFORE UPDATE ON "public"."kpi_evaluations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_kpi_templates_updated_at" BEFORE UPDATE ON "public"."kpi_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tasks_updated_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_units_updated_at" BEFORE UPDATE ON "public"."units" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_work_shifts_updated_at" BEFORE UPDATE ON "public"."work_shifts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."agenda_items"
    ADD CONSTRAINT "agenda_items_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."agenda_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agenda_reports"
    ADD CONSTRAINT "agenda_reports_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."agenda_reports"
    ADD CONSTRAINT "agenda_reports_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agenda_reports"
    ADD CONSTRAINT "agenda_reports_instansi_id_fkey" FOREIGN KEY ("instansi_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approvals"
    ADD CONSTRAINT "approvals_approved_by_hr_fkey" FOREIGN KEY ("approved_by_hr") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."approvals"
    ADD CONSTRAINT "approvals_approved_by_unit_leader_fkey" FOREIGN KEY ("approved_by_unit_leader") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."approvals"
    ADD CONSTRAINT "approvals_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."approvals"
    ADD CONSTRAINT "approvals_instansi_id_fkey" FOREIGN KEY ("instansi_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_instansi_id_fkey" FOREIGN KEY ("instansi_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_instansi_id_fkey" FOREIGN KEY ("instansi_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."work_shifts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id");



ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kpi_evaluations"
    ADD CONSTRAINT "kpi_evaluations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kpi_evaluations"
    ADD CONSTRAINT "kpi_evaluations_evaluator_id_fkey" FOREIGN KEY ("evaluator_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."kpi_evaluations"
    ADD CONSTRAINT "kpi_evaluations_instansi_id_fkey" FOREIGN KEY ("instansi_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kpi_evaluations"
    ADD CONSTRAINT "kpi_evaluations_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."kpi_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kpi_indicators"
    ADD CONSTRAINT "kpi_indicators_instansi_id_fkey" FOREIGN KEY ("instansi_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kpi_indicators"
    ADD CONSTRAINT "kpi_indicators_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."kpi_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kpi_scores"
    ADD CONSTRAINT "kpi_scores_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "public"."kpi_evaluations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kpi_scores"
    ADD CONSTRAINT "kpi_scores_indicator_id_fkey" FOREIGN KEY ("indicator_id") REFERENCES "public"."kpi_indicators"("id");



ALTER TABLE ONLY "public"."kpi_scores"
    ADD CONSTRAINT "kpi_scores_instansi_id_fkey" FOREIGN KEY ("instansi_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kpi_templates"
    ADD CONSTRAINT "kpi_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."kpi_templates"
    ADD CONSTRAINT "kpi_templates_instansi_id_fkey" FOREIGN KEY ("instansi_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."national_holidays"
    ADD CONSTRAINT "national_holidays_instansi_id_fkey" FOREIGN KEY ("instansi_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_instansi_id_fkey" FOREIGN KEY ("instansi_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_instansi_id_fkey" FOREIGN KEY ("instansi_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_kpi_indicator_id_fkey" FOREIGN KEY ("kpi_indicator_id") REFERENCES "public"."kpi_indicators"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."units"
    ADD CONSTRAINT "units_instansi_id_fkey" FOREIGN KEY ("instansi_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."units"
    ADD CONSTRAINT "units_leader_id_fkey" FOREIGN KEY ("leader_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_instansi_id_fkey" FOREIGN KEY ("instansi_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."work_shifts"
    ADD CONSTRAINT "work_shifts_instansi_id_fkey" FOREIGN KEY ("instansi_id") REFERENCES "public"."institutions"("id") ON DELETE CASCADE;



CREATE POLICY "Allow authenticated read on institutions" ON "public"."institutions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read positions" ON "public"."positions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Approvals insert" ON "public"."approvals" FOR INSERT TO "authenticated" WITH CHECK (("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "Approvals read" ON "public"."approvals" FOR SELECT TO "authenticated" USING (("public"."is_admin_or_hr"("auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'director'::"public"."app_role") OR ("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))) OR ("public"."has_role"("auth"."uid"(), 'unit_leader'::"public"."app_role") AND ("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."unit_id" = "public"."get_employee_unit"("auth"."uid"())))))));



CREATE POLICY "Approvals update" ON "public"."approvals" FOR UPDATE TO "authenticated" USING (("public"."is_admin_or_hr"("auth"."uid"()) OR ("public"."has_role"("auth"."uid"(), 'unit_leader'::"public"."app_role") AND ("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."unit_id" = "public"."get_employee_unit"("auth"."uid"())))))));



CREATE POLICY "Attendance insert" ON "public"."attendance" FOR INSERT TO "authenticated" WITH CHECK (("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "Attendance read" ON "public"."attendance" FOR SELECT TO "authenticated" USING (("public"."is_admin_or_hr"("auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'director'::"public"."app_role") OR ("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))) OR ("public"."has_role"("auth"."uid"(), 'unit_leader'::"public"."app_role") AND ("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."unit_id" = "public"."get_employee_unit"("auth"."uid"())))))));



CREATE POLICY "Attendance update" ON "public"."attendance" FOR UPDATE TO "authenticated" USING (("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



CREATE POLICY "Bisa dibaca semua user" ON "public"."national_holidays" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Bisa diubah Admin/HR" ON "public"."national_holidays" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['hr'::"public"."app_role", 'super_admin'::"public"."app_role"]))))));



CREATE POLICY "Collaborative delete indicators" ON "public"."kpi_indicators" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."kpi_templates" "t"
     JOIN "public"."user_roles" "ur" ON (("ur"."instansi_id" = "t"."instansi_id")))
  WHERE (("t"."id" = "kpi_indicators"."template_id") AND ("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['hr'::"public"."app_role", 'unit_leader'::"public"."app_role"]))))));



CREATE POLICY "Collaborative delete templates" ON "public"."kpi_templates" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."instansi_id" = "kpi_templates"."instansi_id") AND ("ur"."role" = ANY (ARRAY['hr'::"public"."app_role", 'unit_leader'::"public"."app_role"]))))));



CREATE POLICY "Collaborative insert indicators" ON "public"."kpi_indicators" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."kpi_templates" "t"
     JOIN "public"."user_roles" "ur" ON (("ur"."instansi_id" = "t"."instansi_id")))
  WHERE (("t"."id" = "kpi_indicators"."template_id") AND ("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['hr'::"public"."app_role", 'unit_leader'::"public"."app_role"]))))));



CREATE POLICY "Collaborative insert templates" ON "public"."kpi_templates" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."instansi_id" = "kpi_templates"."instansi_id") AND ("ur"."role" = ANY (ARRAY['hr'::"public"."app_role", 'unit_leader'::"public"."app_role"]))))));



CREATE POLICY "Collaborative update indicators" ON "public"."kpi_indicators" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."kpi_templates" "t"
     JOIN "public"."user_roles" "ur" ON (("ur"."instansi_id" = "t"."instansi_id")))
  WHERE (("t"."id" = "kpi_indicators"."template_id") AND ("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = ANY (ARRAY['hr'::"public"."app_role", 'unit_leader'::"public"."app_role"]))))));



CREATE POLICY "Collaborative update templates" ON "public"."kpi_templates" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."instansi_id" = "kpi_templates"."instansi_id") AND ("ur"."role" = ANY (ARRAY['hr'::"public"."app_role", 'unit_leader'::"public"."app_role"]))))));



CREATE POLICY "Employees deletable by admin/hr" ON "public"."employees" FOR DELETE TO "authenticated" USING ("public"."is_admin_or_hr"("auth"."uid"()));



CREATE POLICY "Employees insertable by admin/hr" ON "public"."employees" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_or_hr"("auth"."uid"()));



CREATE POLICY "Employees readable by authenticated" ON "public"."employees" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Employees updatable by admin/hr or self" ON "public"."employees" FOR UPDATE TO "authenticated" USING (("public"."is_admin_or_hr"("auth"."uid"()) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "Enable delete for authenticated users only" ON "public"."positions" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable insert for authenticated users only" ON "public"."positions" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Enable read access for all users" ON "public"."positions" FOR SELECT USING (true);



CREATE POLICY "Enable update for authenticated users only" ON "public"."positions" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "KPI evaluations insert" ON "public"."kpi_evaluations" FOR INSERT WITH CHECK ((((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur_hr"
  WHERE (("ur_hr"."user_id" = "auth"."uid"()) AND ("ur_hr"."role" = 'hr'::"public"."app_role") AND ("ur_hr"."instansi_id" = ( SELECT "e"."instansi_id"
           FROM "public"."employees" "e"
          WHERE ("e"."id" = "kpi_evaluations"."employee_id")))))) AND (EXISTS ( SELECT 1
   FROM ("public"."employees" "target_emp"
     JOIN "public"."user_roles" "target_role" ON (("target_role"."user_id" = "target_emp"."user_id")))
  WHERE (("target_emp"."id" = "kpi_evaluations"."employee_id") AND ("target_role"."role" = 'unit_leader'::"public"."app_role"))))) OR (EXISTS ( SELECT 1
   FROM (("public"."user_roles" "ur"
     JOIN "public"."employees" "leader" ON (("leader"."user_id" = "ur"."user_id")))
     JOIN "public"."employees" "target" ON (("target"."id" = "kpi_evaluations"."employee_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'unit_leader'::"public"."app_role") AND ("leader"."unit_id" = "target"."unit_id") AND ("leader"."user_id" <> "target"."user_id"))))));



CREATE POLICY "KPI evaluations update" ON "public"."kpi_evaluations" FOR UPDATE TO "authenticated" USING ((("evaluator_id" = "auth"."uid"()) OR "public"."is_admin_or_hr"("auth"."uid"())));



CREATE POLICY "KPI indicators delete" ON "public"."kpi_indicators" FOR DELETE TO "authenticated" USING ("public"."is_admin_or_hr"("auth"."uid"()));



CREATE POLICY "KPI indicators insert" ON "public"."kpi_indicators" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_or_hr"("auth"."uid"()));



CREATE POLICY "KPI indicators read" ON "public"."kpi_indicators" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "KPI indicators update" ON "public"."kpi_indicators" FOR UPDATE TO "authenticated" USING ("public"."is_admin_or_hr"("auth"."uid"()));



CREATE POLICY "KPI scores insert" ON "public"."kpi_scores" FOR INSERT WITH CHECK (("evaluation_id" IN ( SELECT "kpi_evaluations"."id"
   FROM "public"."kpi_evaluations"
  WHERE ("kpi_evaluations"."evaluator_id" = "auth"."uid"()))));



CREATE POLICY "KPI scores read" ON "public"."kpi_scores" FOR SELECT TO "authenticated" USING (("evaluation_id" IN ( SELECT "kpi_evaluations"."id"
   FROM "public"."kpi_evaluations"
  WHERE ("public"."is_admin_or_hr"("auth"."uid"()) OR ("kpi_evaluations"."employee_id" IN ( SELECT "employees"."id"
           FROM "public"."employees"
          WHERE ("employees"."user_id" = "auth"."uid"()))) OR ("kpi_evaluations"."evaluator_id" = "auth"."uid"())))));



CREATE POLICY "KPI scores update" ON "public"."kpi_scores" FOR UPDATE TO "authenticated" USING (("evaluation_id" IN ( SELECT "kpi_evaluations"."id"
   FROM "public"."kpi_evaluations"
  WHERE (("kpi_evaluations"."evaluator_id" = "auth"."uid"()) OR "public"."is_admin_or_hr"("auth"."uid"())))));



CREATE POLICY "Read indicators" ON "public"."kpi_indicators" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Roles deletable by super_admin" ON "public"."user_roles" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Roles insertable by super_admin" ON "public"."user_roles" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Roles readable by authenticated" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Roles updatable by super_admin" ON "public"."user_roles" FOR UPDATE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Semua bisa melihat cabang" ON "public"."institutions" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Super admin bisa hapus cabang" ON "public"."institutions" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "Super admin bisa tambah cabang" ON "public"."institutions" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "Super admin bisa update cabang" ON "public"."institutions" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role")))));



CREATE POLICY "Tasks delete" ON "public"."tasks" FOR DELETE TO "authenticated" USING (("public"."is_admin_or_hr"("auth"."uid"()) OR ("assigned_by" = "auth"."uid"())));



CREATE POLICY "Tasks insert" ON "public"."tasks" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_admin_or_hr"("auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'unit_leader'::"public"."app_role")));



CREATE POLICY "Tasks read" ON "public"."tasks" FOR SELECT TO "authenticated" USING (("public"."is_admin_or_hr"("auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'director'::"public"."app_role") OR ("assigned_by" = "auth"."uid"()) OR ("assigned_to" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))) OR ("public"."has_role"("auth"."uid"(), 'unit_leader'::"public"."app_role") AND ("assigned_to" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."unit_id" = "public"."get_employee_unit"("auth"."uid"())))))));



CREATE POLICY "Tasks update" ON "public"."tasks" FOR UPDATE TO "authenticated" USING ((("assigned_to" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))) OR "public"."is_admin_or_hr"("auth"."uid"()) OR ("assigned_by" = "auth"."uid"()) OR ("public"."has_role"("auth"."uid"(), 'unit_leader'::"public"."app_role") AND ("assigned_to" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."unit_id" = "public"."get_employee_unit"("auth"."uid"())))))));



CREATE POLICY "Tenant isolation read evaluations" ON "public"."kpi_evaluations" FOR SELECT TO "authenticated" USING ((("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))) OR ("evaluator_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."user_roles" "ur"
     JOIN "public"."employees" "e" ON (("e"."instansi_id" = "ur"."instansi_id")))
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("e"."id" = "kpi_evaluations"."employee_id")))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'super_admin'::"public"."app_role"))))));



CREATE POLICY "Tenant isolation read templates" ON "public"."kpi_templates" FOR SELECT TO "authenticated" USING ((("instansi_id" IS NULL) OR ("instansi_id" IN ( SELECT "ur"."instansi_id"
   FROM "public"."user_roles" "ur"
  WHERE ("ur"."user_id" = "auth"."uid"()))) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'super_admin'::"public"."app_role"))))));



CREATE POLICY "Units deletable by admin/hr" ON "public"."units" FOR DELETE TO "authenticated" USING ("public"."is_admin_or_hr"("auth"."uid"()));



CREATE POLICY "Units readable by authenticated" ON "public"."units" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Units updatable by admin/hr" ON "public"."units" FOR UPDATE TO "authenticated" USING ("public"."is_admin_or_hr"("auth"."uid"()));



CREATE POLICY "Units writable by admin/hr" ON "public"."units" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_or_hr"("auth"."uid"()));



CREATE POLICY "Work shifts deletable by admin/hr" ON "public"."work_shifts" FOR DELETE TO "authenticated" USING ("public"."is_admin_or_hr"("auth"."uid"()));



CREATE POLICY "Work shifts insertable by admin/hr" ON "public"."work_shifts" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin_or_hr"("auth"."uid"()));



CREATE POLICY "Work shifts readable by authenticated" ON "public"."work_shifts" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Work shifts updatable by admin/hr" ON "public"."work_shifts" FOR UPDATE TO "authenticated" USING ("public"."is_admin_or_hr"("auth"."uid"()));



CREATE POLICY "admin_hr_view_reports" ON "public"."agenda_reports" FOR SELECT USING ("public"."is_admin_or_hr"("auth"."uid"()));



ALTER TABLE "public"."agenda_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agenda_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."approvals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."attendance" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."institutions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "institutions_insert_director" ON "public"."institutions" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("auth"."uid"(), 'director'::"public"."app_role"));



CREATE POLICY "institutions_update_director" ON "public"."institutions" FOR UPDATE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'director'::"public"."app_role"));



CREATE POLICY "items_via_report" ON "public"."agenda_items" USING (("report_id" IN ( SELECT "agenda_reports"."id"
   FROM "public"."agenda_reports")));



ALTER TABLE "public"."kpi_evaluations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kpi_evaluations_select" ON "public"."kpi_evaluations" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['super_admin'::"public"."app_role", 'director'::"public"."app_role"]))))) OR (EXISTS ( SELECT 1
   FROM ("public"."employees" "e"
     JOIN "public"."user_roles" "ur" ON (("ur"."instansi_id" = "e"."instansi_id")))
  WHERE (("e"."id" = "kpi_evaluations"."employee_id") AND ("ur"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."kpi_indicators" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kpi_indicators_select" ON "public"."kpi_indicators" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['super_admin'::"public"."app_role", 'director'::"public"."app_role"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."kpi_templates" "t"
  WHERE (("t"."id" = "kpi_indicators"."template_id") AND ("t"."instansi_id" IN ( SELECT "user_roles"."instansi_id"
           FROM "public"."user_roles"
          WHERE ("user_roles"."user_id" = "auth"."uid"()))))))));



ALTER TABLE "public"."kpi_scores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kpi_scores_select" ON "public"."kpi_scores" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['super_admin'::"public"."app_role", 'director'::"public"."app_role"]))))) OR (EXISTS ( SELECT 1
   FROM ("public"."kpi_evaluations" "e"
     JOIN "public"."employees" "emp" ON (("emp"."id" = "e"."employee_id")))
  WHERE (("e"."id" = "kpi_scores"."evaluation_id") AND ("emp"."instansi_id" IN ( SELECT "user_roles"."instansi_id"
           FROM "public"."user_roles"
          WHERE ("user_roles"."user_id" = "auth"."uid"()))))))));



ALTER TABLE "public"."kpi_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kpi_templates_select" ON "public"."kpi_templates" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['super_admin'::"public"."app_role", 'director'::"public"."app_role"]))))) OR ("instansi_id" IN ( SELECT "user_roles"."instansi_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."national_holidays" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "own_reports_all" ON "public"."agenda_reports" USING (("employee_id" IN ( SELECT "employees"."id"
   FROM "public"."employees"
  WHERE ("employees"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."positions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "unit_leader_update_reports" ON "public"."agenda_reports" FOR UPDATE USING (("public"."has_role"("auth"."uid"(), 'unit_leader'::"public"."app_role") AND ("employee_id" IN ( SELECT "e"."id"
   FROM "public"."employees" "e"
  WHERE ("e"."unit_id" = ( SELECT "employees"."unit_id"
           FROM "public"."employees"
          WHERE ("employees"."user_id" = "auth"."uid"())
         LIMIT 1))))));



CREATE POLICY "unit_leader_view_reports" ON "public"."agenda_reports" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'unit_leader'::"public"."app_role") AND ("employee_id" IN ( SELECT "e"."id"
   FROM "public"."employees" "e"
  WHERE ("e"."unit_id" = ( SELECT "employees"."unit_id"
           FROM "public"."employees"
          WHERE ("employees"."user_id" = "auth"."uid"())
         LIMIT 1))))));



ALTER TABLE "public"."units" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."work_shifts" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";











































































































































































GRANT ALL ON FUNCTION "public"."delete_auth_user"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_auth_user"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_auth_user"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_employee_complete"("employee_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_employee_complete"("employee_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_employee_complete"("employee_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_employee_unit"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_employee_unit"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_employee_unit"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin_or_hr"("_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin_or_hr"("_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin_or_hr"("_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_absences_for_today"() TO "anon";
GRANT ALL ON FUNCTION "public"."mark_absences_for_today"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_absences_for_today"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_employee_unit_leader_role"("target_user_id" "uuid", "new_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_employee_unit_leader_role"("target_user_id" "uuid", "new_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_employee_unit_leader_role"("target_user_id" "uuid", "new_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";
























GRANT ALL ON TABLE "public"."agenda_items" TO "anon";
GRANT ALL ON TABLE "public"."agenda_items" TO "authenticated";
GRANT ALL ON TABLE "public"."agenda_items" TO "service_role";



GRANT ALL ON TABLE "public"."agenda_reports" TO "anon";
GRANT ALL ON TABLE "public"."agenda_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."agenda_reports" TO "service_role";



GRANT ALL ON TABLE "public"."approvals" TO "anon";
GRANT ALL ON TABLE "public"."approvals" TO "authenticated";
GRANT ALL ON TABLE "public"."approvals" TO "service_role";



GRANT ALL ON TABLE "public"."attendance" TO "anon";
GRANT ALL ON TABLE "public"."attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance" TO "service_role";



GRANT ALL ON TABLE "public"."employees" TO "anon";
GRANT ALL ON TABLE "public"."employees" TO "authenticated";
GRANT ALL ON TABLE "public"."employees" TO "service_role";



GRANT ALL ON TABLE "public"."institutions" TO "anon";
GRANT ALL ON TABLE "public"."institutions" TO "authenticated";
GRANT ALL ON TABLE "public"."institutions" TO "service_role";



GRANT ALL ON TABLE "public"."kpi_evaluations" TO "anon";
GRANT ALL ON TABLE "public"."kpi_evaluations" TO "authenticated";
GRANT ALL ON TABLE "public"."kpi_evaluations" TO "service_role";



GRANT ALL ON TABLE "public"."kpi_indicators" TO "anon";
GRANT ALL ON TABLE "public"."kpi_indicators" TO "authenticated";
GRANT ALL ON TABLE "public"."kpi_indicators" TO "service_role";



GRANT ALL ON TABLE "public"."kpi_scores" TO "anon";
GRANT ALL ON TABLE "public"."kpi_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."kpi_scores" TO "service_role";



GRANT ALL ON TABLE "public"."kpi_templates" TO "anon";
GRANT ALL ON TABLE "public"."kpi_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."kpi_templates" TO "service_role";



GRANT ALL ON TABLE "public"."national_holidays" TO "anon";
GRANT ALL ON TABLE "public"."national_holidays" TO "authenticated";
GRANT ALL ON TABLE "public"."national_holidays" TO "service_role";



GRANT ALL ON TABLE "public"."positions" TO "anon";
GRANT ALL ON TABLE "public"."positions" TO "authenticated";
GRANT ALL ON TABLE "public"."positions" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."units" TO "anon";
GRANT ALL ON TABLE "public"."units" TO "authenticated";
GRANT ALL ON TABLE "public"."units" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."work_shifts" TO "anon";
GRANT ALL ON TABLE "public"."work_shifts" TO "authenticated";
GRANT ALL ON TABLE "public"."work_shifts" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































