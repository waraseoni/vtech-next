
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSchema() {
  const { data, error } = await supabase.rpc('get_table_definition', { table_name: 'activity_logs' });
  if (error) {
    // If RPC doesn't exist, try a simple query to see error message or guess
    const { data: testData, error: testError } = await supabase.from('activity_logs').select('*').limit(1);
    console.log('Test query data:', testData);
    console.log('Test query error:', testError);
  } else {
    console.log('Schema:', data);
  }
}

checkSchema();
