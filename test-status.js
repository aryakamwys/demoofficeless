const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: claim } = await supabase.from('claims').select('status, manager_status, hr_status').eq('id', '7f059eb5-2d79-4d8e-b37c-1f2e7a09bbb0').single();
  console.log('Claim Status:', claim);
}
check();
