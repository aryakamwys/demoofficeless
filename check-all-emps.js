const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function main() {
  const { data: emps } = await supabase.from('employees').select('id, employee_name, role, manager_id, hr_id');
  console.log("All Employees:", emps);
}
main();
