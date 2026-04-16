-- Migration to add missing fields to the employees table
-- This matches the fields expected by the frontend in src/pages/employees/index.tsx

ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS employee_id_number TEXT,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS nationality TEXT,
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS birth_place TEXT,
ADD COLUMN IF NOT EXISTS religion TEXT,
ADD COLUMN IF NOT EXISTS marital_status TEXT,
ADD COLUMN IF NOT EXISTS identity_card_type TEXT,
ADD COLUMN IF NOT EXISTS identity_card_number TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS address_domicile TEXT,
ADD COLUMN IF NOT EXISTS education_level TEXT,
ADD COLUMN IF NOT EXISTS education_institution TEXT,
ADD COLUMN IF NOT EXISTS education_major TEXT,
ADD COLUMN IF NOT EXISTS contract_end_date DATE,
ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- Add comment for clarity
COMMENT ON TABLE public.employees IS 'Table to store detailed employee profiles for HRIS';
