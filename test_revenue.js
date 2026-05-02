const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  const clientId = 2; // Test for client 2
  
  // 1. Transaction List (Status 5)
  const { data: txns } = await supabase
    .from('transaction_list')
    .select('id, amount, status, date_created')
    .eq('client_name', String(clientId));
    
  let repairBilled = 0;
  for (const t of txns || []) {
    if (t.status === 5) {
      repairBilled += (t.amount || 0);
    }
  }

  // 1b. Transaction List (Status 3, etc)
  let otherStatusBilled = 0;
  for (const t of txns || []) {
    if (t.status === 3) {
      otherStatusBilled += (t.amount || 0);
    }
  }

  // 2. Direct Sales
  const { data: sales } = await supabase
    .from('direct_sales')
    .select('id, total_amount, date_created')
    .eq('client_id', clientId);
    
  let directBilled = 0;
  for (const s of sales || []) {
    directBilled += (s.total_amount || 0);
  }

  console.log("=== RESULTS FOR CLIENT 2 ===");
  console.log("Repair Billed (Status 5): ", repairBilled);
  console.log("Repair Billed (Status 3): ", otherStatusBilled);
  console.log("Direct Billed: ", directBilled);
  console.log("TOTAL BILLED (Profile View expects status 5): ", repairBilled + directBilled);

  console.log("\nRaw Txns (Status 5):", txns.filter(t => t.status === 5));
  console.log("Raw Txns (Status 3):", txns.filter(t => t.status === 3));
  console.log("Raw Direct Sales:", sales);
}

check();
