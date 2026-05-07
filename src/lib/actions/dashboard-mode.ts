"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import type { DashboardMode } from "@/lib/dashboard-mode"

const COOKIE = "dashboard_mode"
const ONE_YEAR = 60 * 60 * 24 * 365

export async function setDashboardMode(mode: DashboardMode) {
  const c = await cookies()
  c.set(COOKIE, mode, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
    httpOnly: false, // we want client toggles to be able to read it later if needed
  })
  revalidatePath("/dashboard")
  return { ok: true }
}
