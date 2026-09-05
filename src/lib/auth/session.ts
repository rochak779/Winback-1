import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function getUserId(): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}
