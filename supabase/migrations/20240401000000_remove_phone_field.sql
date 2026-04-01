-- Migration to remove the 'phone' column from the 'employees' table
-- This is done because the 'whatsapp_number' field is now the primary contact method.

ALTER TABLE employees DROP COLUMN IF EXISTS phone;
