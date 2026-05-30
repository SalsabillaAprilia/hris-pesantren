import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://syifictvskydmyqtfcfh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5aWZpY3R2c2t5ZG15cXRmY2ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NzYyMTcsImV4cCI6MjA4OTE1MjIxN30.Ok7zaukaMExDHb5Z9Do7eU2wM3xROdeldrZowCdTIIs';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: emps, error: err1 } = await supabase.from('employees').select('*').in('status', ['active', 'on_leave']);
  console.log('Global Emps:', emps?.length);

  const { data: roles, error: err2 } = await supabase.from('user_roles').select('user_id, role, instansi_id');
  console.log('Global Roles:', roles?.length);

  const { data: inst } = await supabase.from('institutions').select('*');
  const ponpes = inst?.find(i => i.name.toLowerCase().includes('ponpes'));

  if (ponpes) {
    const { data: ponpesEmps } = await supabase.from('employees').select('*').in('status', ['active', 'on_leave']).eq('instansi_id', ponpes.id);
    console.log('Ponpes Emps:', ponpesEmps?.length);
  }
}

main().catch(console.error);
