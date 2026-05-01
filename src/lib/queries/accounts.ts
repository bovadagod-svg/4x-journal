import { createClient } from "@/lib/supabase/server"

export async function getUserAccounts() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("accounts")
    .select("*")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
  return data ?? []
}

export async function getUserPlaybooks() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("playbooks")
    .select("id, name, color, target_r")
    .order("name")
  return data ?? []
}
