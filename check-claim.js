const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function main() {
  const { data: claim } = await supabase.from('claims').select('id, employee_id, manager_id, hr_id').eq('id', '2d47df09-d419-4ab0-a531-fa599490fd6c').single();
  console.log("Specific Claim:", claim);
}
main();
