const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.rpc('get_schema_columns', { table_name: 'employees' });
  if (error) {
    console.error("Error with RPC, trying simple select:", error);
    const { data: selectData, error: selectError } = await supabase.from('employees').select('*').limit(1);
    if (selectError) {
      console.error(selectError);
    } else {
      if (selectData && selectData.length > 0) {
        console.log("Columns:", Object.keys(selectData[0]));
      } else {
        console.log("Table is empty, can't infer columns easily.");
      }
    }
  } else {
    console.log(data);
  }
}
check();
