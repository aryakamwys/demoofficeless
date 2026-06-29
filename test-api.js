const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function main() {
  const id = '2d47df09-d419-4ab0-a531-fa599490fd6c';
  
  const { data: claim } = await supabase
    .from("claims")
    .select("*, employee:employees!claims_employee_id_fkey(*)")
    .eq("id", id)
    .single();
    
  let manager_signature = null;
  const managerIdToUse = claim.manager_id || claim.employee?.manager_id;
  if (managerIdToUse) {
    const { data: managerSig, error } = await supabase.from('signatures').select('signature').eq('employee_id', managerIdToUse).single();
    if (managerSig) manager_signature = managerSig.signature.substring(0, 50) + "...";
    console.log("Manager Sig fetch result:", managerSig ? "FOUND" : "NOT FOUND", error);
  }
  
  console.log("Returned manager_signature:", manager_signature);
}
main();
