const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rklyznlrcrysdpksltxm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrbHl6bmxyY3J5c2Rwa3NsdHhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTgxODcwMywiZXhwIjoyMDg3Mzk0NzAzfQ.RXd3Mdd2p690Eviw7GbLv8LW1oi9cmPeb9XSu3fDJaw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const clientId = 2; // Test for client 2
  
  const { data: txns } = await supabase
    .from('transaction_list')
    .select('id, amount, status, date_created')
    .eq('client_name', String(clientId));

  let total2026 = 0;
  let totalAll = 0;
  
  for (const t of txns || []) {
    if (t.status === 5) {
      totalAll += (t.amount || 0);
      if (t.date_created.startsWith('2026')) {
         total2026 += (t.amount || 0);
      }
    }
  }

  console.log("Total All Time (Status 5): ", totalAll);
  console.log("Total 2026 Only (Status 5): ", total2026);
  
  let total2026_status35 = 0;
  for (const t of txns || []) {
    if (t.status === 5 || t.status === 3) {
      if (t.date_created.startsWith('2026')) {
         total2026_status35 += (t.amount || 0);
      }
    }
  }
  console.log("Total 2026 Only (Status 3 or 5): ", total2026_status35);
  
  let totalAll_status35 = 0;
  for (const t of txns || []) {
    if (t.status === 5 || t.status === 3) {
      totalAll_status35 += (t.amount || 0);
    }
  }
  console.log("Total All (Status 3 or 5): ", totalAll_status35);
}

check();
