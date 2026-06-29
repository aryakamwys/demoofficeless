const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
async function main() {
  const { data, error } = await supabase.rpc('exec_sql', { query: `
    SELECT tablename, policyname, roles, cmd, qual FROM pg_policies WHERE tablename IN ('employees', 'signatures');
  `});
  if (error) {
    console.error("RPC Error:", error.message);
    // fallback, let's just insert a dummy record using anon key to see if it works
    const anon = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { error: insErr } = await anon.from('signatures').insert({ employee_id: '00000000-0000-0000-0000-000000000000', signature: 'test' });
    console.log("Anon insert error:", insErr?.message || "Success");
  } else {
    console.log(data);
  }
}
main();
