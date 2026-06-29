const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const anon = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function main() {
  const { error } = await anon.from('employees').update({ department: 'Test' }).eq('employee_number', 'EMP-001');
  console.log("Anon update employees error:", error?.message || "Success");
}
main();
