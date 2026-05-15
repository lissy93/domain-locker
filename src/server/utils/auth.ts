import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { H3Event } from 'h3';

const IS_MANAGED = import.meta.env['DL_ENV_TYPE'] === 'managed';

let SUPABASE_CLIENT: SupabaseClient | null = null;

if (IS_MANAGED) {
  try {
    const SUPABASE_URL = import.meta.env['SUPABASE_URL'];
    const SUPABASE_ANON_KEY = import.meta.env['SUPABASE_ANON_KEY'];

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Missing Supabase environment variables');
    }

    SUPABASE_CLIENT = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (error) {
    console.error('Error configuring Supabase:', error);
    SUPABASE_CLIENT = null;
  }
}

export async function verifyAuth(
  event: H3Event,
): Promise<{ success: boolean; error?: string }> {
  if (!IS_MANAGED) return { success: true }; // Skip auth if not in managed mode

  if (!SUPABASE_CLIENT) {
    return { success: false, error: 'Auth not configured' };
  }

  const authHeader = event.node.req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('Missing or invalid Authorization header');
    return { success: false, error: 'Missing or invalid Authorization header' };
  }

  const token = authHeader.split(' ')[1];
  try {
    const { data, error } = await SUPABASE_CLIENT.auth.getUser(token);

    if (error || !data?.user) {
      console.error('Authentication failed:', error);
      return { success: false, error: 'Authentication failed' };
    }

    return { success: true };
  } catch (err) {
    console.error('Error verifying authentication:', err);
    return { success: false, error: 'Error verifying authentication' };
  }
}
