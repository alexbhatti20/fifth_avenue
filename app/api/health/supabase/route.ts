import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const envVars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'PRESENT' : 'MISSING',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'PRESENT' : 'MISSING',
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ? 'PRESENT' : 'MISSING',
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ? 'PRESENT' : 'MISSING',
  };

  try {
    // Try a simple query to verify connection
    const { data, error } = await supabase.from('categories').select('count', { count: 'exact', head: true });
    
    return NextResponse.json({
      status: error ? 'error' : 'ok',
      connection: error ? 'failed' : 'successful',
      env: envVars,
      error: error ? {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      } : null,
      message: error 
        ? "Supabase connection failed. Check your environment variables and RLS policies." 
        : "Supabase connection successful."
    });
  } catch (err: any) {
    return NextResponse.json({
      status: 'exception',
      env: envVars,
      error: err.message,
      message: "An unexpected error occurred while connecting to Supabase."
    }, { status: 500 });
  }
}
