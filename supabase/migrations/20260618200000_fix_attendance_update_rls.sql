-- Fix RLS Policy for Attendance Update to allow Admin/HR to correct attendance
DROP POLICY IF EXISTS "Attendance update" ON "public"."attendance";

CREATE POLICY "Attendance update" ON "public"."attendance" 
FOR UPDATE TO "authenticated" 
USING (
  "public"."is_admin_or_hr"("auth"."uid"()) OR 
  ("employee_id" IN ( SELECT "employees"."id" FROM "public"."employees" WHERE ("employees"."user_id" = "auth"."uid"())))
);
