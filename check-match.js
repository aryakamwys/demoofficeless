const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function main() {
  const { data: claim } = await supabase.from('claims').select('manager_id, hr_id, employee_id').limit(1).single();
  const { data: sigs } = await supabase.from('signatures').select('employee_id');
  console.log("Claim IDs:", claim);
  console.log("Signatures IDs:", sigs.map(s => s.employee_id));
}
main();
