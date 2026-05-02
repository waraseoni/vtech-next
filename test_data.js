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
    
  let repairBilled = 0;
  for (const t of txns || []) {
    if (t.status === 5) repairBilled += (t.amount || 0);
  }

  const { data: sales } = await supabase
    .from('direct_sales')
    .select('id, total_amount, date_created')
    .eq('client_id', clientId);
    
  let directBilled = 0;
  for (const s of sales || []) {
    directBilled += (s.total_amount || 0);
  }

  console.log("=== CLIENT 2 TOTALS ===");
  console.log("Total Repair Billed (status 5):", repairBilled);
  console.log("Total Direct Sale:", directBilled);
  console.log("GRAND TOTAL BILLED:", repairBilled + directBilled);

  console.log("RAW REPAIRS (Status 5): ", txns.filter(t => t.status === 5));
  console.log("RAW DIRECT SALES: ", sales);
}

check();
