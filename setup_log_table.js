const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://ffgqhhyjjsubvbmzmzzj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZ3FoaHlqanN1YnZibXptenpqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTA0MjMxOSwiZXhwIjoyMDk2NjE4MzE5fQ.n7WvWaAEnuyBUYtgxCf60imyPWsAt8ySybYly6hPGBw');

async function main() {
  const { error } = await supabase.rpc('exec_sql', { query: `
    CREATE TABLE IF NOT EXISTS temp_webhook_logs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      payload JSONB,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `});
  console.log("RPC Error:", error);
}
main();
