const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function main() {
  const { data: dede } = await supabase.from('employees').select('id, manager_id, hr_id').eq('id', 'fd1ba584-8366-4e99-92e6-df0980c237fa').single();
  console.log("Dede's IDs:", dede);
}
main();
