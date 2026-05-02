import { cache } from "react"
import { createClient } from "@/lib/supabase/server"

/**
 * Resolve the current user's account scope.
 *
 * Returns either "all" (aggregate across every account) or a UUID for a
 * specific account. Auto-falls back to "all" if the scope refers to a
 * deleted account so we never silently render empty data.
 *
 * Cached per request via React's `cache()` so multiple queries on the same
 * page share one round-trip.
 */
export const getCurrentScope = cache(async (): Promise<string> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return "all"

  const { data: settings } = await supabase
    .from("user_settings")
    .select("account_scope")
    .eq("user_id", user.id)
    .maybeSingle()

  const scope = settings?.account_scope ?? "all"
  if (scope === "all") return "all"

  // Validate the scoped account still exists.
  const { count } = await supabase
    .from("accounts")
    .select("*", { count: "exact", head: true })
    .eq("id", scope)
  return count && count > 0 ? scope : "all"
})
