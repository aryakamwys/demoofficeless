const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: claims } = await supabase.from('claims').select('id, status').limit(5);
  console.log('Claims:', claims);
  
  const { data: mclaims } = await supabase.from('managed_service_claims').select('id, customer_name, ticket_id');
  console.log('Managed Claims:', mclaims);
}
check();
