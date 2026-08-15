const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Helper to delay (rate limiting)
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function runForceRestore() {
  console.log("Reading environment variables...");
  const envFile = fs.readFileSync('.env.local', 'utf-8');
  const envVars = envFile.split('\n').reduce((acc, line) => {
    const [key, ...val] = line.split('=');
    if (key && val.length) acc[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
    return acc;
  }, {});

  const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY not found in .env.local");
  }

  console.log("Initializing Supabase Client with Service Role Key (Bypassing RLS)...");
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("Reading backup file 'vtech_backup_restore.json'...");
  const data = JSON.parse(fs.readFileSync('vtech_backup_restore.json', 'utf-8'));

  const tablesToRestore = ['product_list', 'transaction_images'];

  for (const table of tablesToRestore) {
    const rawRows = data[table];
    if (!rawRows || rawRows.length === 0) {
      console.log(`No data found for table ${table}, skipping.`);
      continue;
    }
    console.log(`\nProcessing ${table} (${rawRows.length} rows)...`);

    // Pre-process rows matching backup/page.tsx logic
    const rows = rawRows.map(row => {
      const r = { ...row };
      
      // Allowed cols
      let allowedCols = [];
      if (table === 'product_list') {
        allowedCols = ["id", "name", "description", "cost_price", "price", "image_path", "status", "delete_flag", "date_created", "date_updated", "hsn", "alert_quantity", "barcode"];
      } else if (table === 'transaction_images') {
        allowedCols = ["id", "transaction_id", "image_path", "date_created"];
      }

      Object.keys(r).forEach(key => {
        if (!allowedCols.includes(key)) delete r[key];
      });

      // Fix numeric
      for (const pf of ["price","cost_price","amount","discount"]) {
        if (pf in r && typeof r[pf] === "number" && r[pf] < 0) r[pf] = 0;
      }
      
      // Fix string
      for (const tf of ["name","description","hsn","item","remark"]) {
        if (tf in r) {
          if (r[tf] === null || r[tf] === undefined) r[tf] = "";
          else if (typeof r[tf] !== "string") r[tf] = String(r[tf]);
        }
      }

      // Fix zero dates
      for (const key of Object.keys(r)) {
        if (typeof r[key] === "string" && r[key].startsWith("0000-00-00")) {
          r[key] = null;
        }
      }
      return r;
    });

    // Batch insert
    const batchSize = 25;
    let totalRestored = 0;
    
    for (let i = 0; i < rows.length; i += batchSize) {
      let batch = rows.slice(i, i + batchSize);
      
      const { error: insErr } = await supabase.from(table).upsert(batch);
      
      if (insErr) {
        console.log(`Batch ${i} error: ${insErr.message}. Falling back to row-by-row...`);
        for (const row of batch) {
          await sleep(100);
          const { error: rowErr } = await supabase.from(table).upsert(row);
          if (!rowErr) {
            totalRestored++;
          } else {
            console.error(`Row error in ${table} for ID ${row.id}: ${rowErr.message}`);
          }
        }
      } else {
        totalRestored += batch.length;
      }
      await sleep(50); // Rate limiting
    }
    console.log(`✅ Successfully restored ${totalRestored} rows for ${table}`);
  }
  
  console.log("\nRestore process complete!");
}

runForceRestore().catch(console.error);
