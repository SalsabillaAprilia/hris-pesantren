import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data: apprData, error } = await supabase
    .from("approvals")
    .select("*, employees!inner(name, unit_id, user_id)")
    .eq("status", "pending");
  
  if (error) {
    console.error("Error fetching approvals:", error);
    return;
  }
  
  console.log("Pending approvals count:", apprData?.length);
  
  if (apprData && apprData.length > 0) {
    console.log("Sample approval:");
    console.log(JSON.stringify(apprData[0], null, 2));
    
    const userIds = [...new Set(apprData.map((a) => a.employees?.user_id).filter(Boolean))];
    console.log("User IDs of submitters:", userIds);
    
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("user_id, role, instansi_id")
      .in("user_id", userIds);
      
    console.log("Roles for submitters:", rolesData);
  }
}

check();
