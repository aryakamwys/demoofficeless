const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { error } = await supabase.rpc('exec_sql', { query: `
    CREATE TABLE IF NOT EXISTS public.signatures (
      employee_id UUID PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
      signature TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `});
  if (error) {
    console.error("Error creating table:", error);
  } else {
    console.log("Table signatures created successfully.");
  }
}
main();
