const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const id = '7f059eb5-2d79-4d8e-b37c-1f2e7a09bbb0';
  const { data: claim, error } = await supabase
    .from("claims")
    .select("*, employee:employees!claims_employee_id_fkey(*)")
    .eq("id", id)
    .single();

  console.log("Claim employee:", claim.employee);
  
  let ticket = null;
  if (claim.employee?.employee_name) {
    console.log("Found employee name:", claim.employee.employee_name);
    const { data: tickets } = await supabase
      .from("managed_service_claims")
      .select("*")
      .ilike("customer_name", claim.employee.employee_name)
      .order("created_at", { ascending: false })
      .limit(1);
    
    if (tickets && tickets.length > 0) {
      ticket = tickets[0];
    } else if (claim.status === 'APPROVED') {
      ticket = { mock: true };
    }
  } else {
    console.log("No employee_name property found!");
  }
  console.log("Ticket result:", ticket);
}
check();
