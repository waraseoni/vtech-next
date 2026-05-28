import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('module, action')
    .limit(100);

  return NextResponse.json({ data, error });
}
