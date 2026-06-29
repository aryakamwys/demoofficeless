const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function main() {
  const { data, error } = await supabase.from('signatures').select('employee_id');
  if (data) {
    console.log("Signatures found:", data.length);
  } else {
    console.log("No data, or error", error);
  }
}
main();
