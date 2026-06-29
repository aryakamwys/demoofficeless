const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function main() {
  const { data: claims } = await supabase.from('claims').select('id, employee_id, manager_id, hr_id, status, updated_at').order('updated_at', { ascending: false }).limit(5);
  console.log("Recent Claims:", claims);
}
main();
