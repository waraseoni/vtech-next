const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env.local', 'utf-8');
const envVars = envFile.split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val.length) acc[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixRLS() {
  const query = `
    -- Enable RLS (if not already enabled)
    alter table public.product_list enable row level security;
    alter table public.transaction_images enable row level security;

    -- Drop existing staff policies if they exist
    drop policy if exists portal_product_list_staff on public.product_list;
    drop policy if exists portal_transaction_images_staff on public.transaction_images;

    -- Create new policies for staff/admin to do EVERYTHING (including insert/restore)
    create policy portal_product_list_staff on public.product_list
      for all to authenticated
      using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
      with check (true);

    create policy portal_transaction_images_staff on public.transaction_images
      for all to authenticated
      using (coalesce((select role from public.profiles where id = auth.uid()), '') in ('admin', 'staff'))
      with check (true);
  `;
  
  // Actually, we can't run raw SQL using supabase-js without an RPC. 
  // Let's create an RPC or just tell the user.
}
