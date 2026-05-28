import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase
    .from('transaction_list')
    .select('*')
    .eq('status', 2)
    .limit(5);

  return NextResponse.json({ data, error });
}
