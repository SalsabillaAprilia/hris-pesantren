-- Migration: 20260524000001_refactor_approvals_schema.sql

-- 1. Add new value 'approved' to approval_status
ALTER TYPE approval_status ADD VALUE IF NOT EXISTS 'approved';

-- 2. Add new values to approval_type
ALTER TYPE approval_type ADD VALUE IF NOT EXISTS 'sick';
ALTER TYPE approval_type ADD VALUE IF NOT EXISTS 'wfa';

-- 3. Add reject_reason to approvals table
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS reject_reason TEXT;

-- 4. Commit transaction to make the new enum value available for usage
COMMIT;

-- 5. Migrate old data
UPDATE approvals SET status = 'approved' WHERE status IN ('approved_unit_leader', 'approved_hr');
