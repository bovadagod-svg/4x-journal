import type { NextConfig } from "next"

// Pin Turbopack to this app dir — there's a stray package-lock.json in the
// user's home that otherwise gets picked as the inferred root and breaks
// Tailwind v4 module resolution.
const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
}

export default nextConfig
