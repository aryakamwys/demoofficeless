const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://ffgqhhyjjsubvbmzmzzj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZ3FoaHlqanN1YnZibXptenpqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTA0MjMxOSwiZXhwIjoyMDk2NjE4MzE5fQ.n7WvWaAEnuyBUYtgxCf60imyPWsAt8ySybYly6hPGBw');

async function main() {
  const { error } = await supabase.rpc('exec_sql', { query: `
    CREATE TABLE IF NOT EXISTS managed_service_claims (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      ticket_id VARCHAR NOT NULL,
      ticket_title VARCHAR,
      customer_name VARCHAR,
      location VARCHAR,
      amount NUMERIC NOT NULL,
      file_url VARCHAR NOT NULL,
      status VARCHAR DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `});
  if (error) {
    console.error("Error creating table:", error);
  } else {
    console.log("Table managed_service_claims created successfully.");
  }
}
main();
