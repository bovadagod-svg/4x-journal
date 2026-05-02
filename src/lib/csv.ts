// Pure CSV helpers — RFC 4180-ish. Quotes anything containing comma, quote, or newline.

export function csvEscape(value: unknown): string {
  if (value == null) return ""
  const s = String(value)
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const head = headers.map(csvEscape).join(",")
  const body = rows.map((r) => r.map(csvEscape).join(",")).join("\n")
  return `${head}\n${body}\n`
}
