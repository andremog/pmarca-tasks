import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export const storage = {
  async get(key: string): Promise<{ value: string } | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("kv_store")
      .select("value")
      .eq("user_id", user.id)
      .eq("key", key)
      .single();

    if (error || !data) return null;
    return { value: JSON.stringify(data.value) };
  },

  async set(key: string, value: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Parse the string value to store as JSONB
    let parsed: any;
    try { parsed = JSON.parse(value); } catch { parsed = value; }

    await supabase.rpc("upsert_kv", {
      p_key: key,
      p_value: parsed,
    });
  },
};
