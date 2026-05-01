import type { Metadata } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { createClient } from "@/lib/supabase/server"
import "./globals.css"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
})
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
})

export const metadata: Metadata = {
  title: "4x Journal — Forex Trading Journal",
  description: "Pre-trade thinking, live notes, post-trade lessons. Built for FX traders.",
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Read settings server-side so the very first paint already uses the user's
  // theme/accent/density. Falls back to defaults for unauth'd visitors.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let theme = "dark"
  let accent = "purple"
  let density = "regular"

  if (user) {
    const { data: settings } = await supabase
      .from("user_settings")
      .select("theme, accent, density")
      .eq("user_id", user.id)
      .maybeSingle()
    if (settings) {
      theme = settings.theme
      accent = settings.accent
      density = settings.density
    }
  }

  return (
    <html
      lang="en"
      data-theme={theme}
      data-accent={accent}
      data-density={density}
      className={`${inter.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  )
}
