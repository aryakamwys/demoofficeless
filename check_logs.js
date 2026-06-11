const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://ffgqhhyjjsubvbmzmzzj.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZ3FoaHlqanN1YnZibXptenpqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTA0MjMxOSwiZXhwIjoyMDk2NjE4MzE5fQ.n7WvWaAEnuyBUYtgxCf60imyPWsAt8ySybYly6hPGBw');

async function main() {
  const { data, error } = await supabase.from('whatsapp_logs').select('*').order('created_at', { ascending: false }).limit(20);
  if (error) console.error(error);
  console.log(JSON.stringify(data, null, 2));
}
main();
