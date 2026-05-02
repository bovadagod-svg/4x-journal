"use client"

import { useCallback, useEffect, useState } from "react"
import { Icon } from "@/components/icons"
import { createClient } from "@/lib/supabase/client"
import { addScreenshot, removeScreenshot } from "@/lib/actions/journal-entries"

type Screenshot = { id: string; path: string; caption: string | null; ts: string }

export function ScreenshotsTab({
  entryId,
  shots,
  onShotsChange,
}: {
  entryId: string
  shots: Screenshot[]
  onShotsChange: (next: Screenshot[]) => void
}) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Generate signed URLs for the bucket (private bucket — can't use public links)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (shots.length === 0) { setSignedUrls({}); return }
      const supabase = createClient()
      const map: Record<string, string> = {}
      for (const s of shots) {
        const { data } = await supabase.storage
          .from("journal-screenshots")
          .createSignedUrl(s.path, 60 * 60)
        if (data?.signedUrl) map[s.id] = data.signedUrl
      }
      if (!cancelled) setSignedUrls(map)
    })()
    return () => { cancelled = true }
  }, [shots])

  const onFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = "" // allow re-upload of same name
    setError(null)
    setUploading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError("Not signed in."); setUploading(false); return }

    const ext = file.name.split(".").pop() ?? "png"
    const path = `${user.id}/${entryId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`

    const { error: upErr } = await supabase.storage
      .from("journal-screenshots")
      .upload(path, file, { contentType: file.type, upsert: false })
    if (upErr) {
      setError(upErr.message)
      setUploading(false)
      return
    }

    const r = await addScreenshot({ entryId, path, caption: null })
    if (!r.ok) {
      setError(r.error)
      // best-effort: remove the orphan upload
      await supabase.storage.from("journal-screenshots").remove([path]).catch(() => {})
    } else {
      onShotsChange([
        ...shots,
        { id: crypto.randomUUID(), path, caption: null, ts: new Date().toISOString() },
      ])
    }
    setUploading(false)
  }, [entryId, shots, onShotsChange])

  const onRemove = useCallback(async (s: Screenshot) => {
    if (!confirm("Remove this screenshot?")) return
    onShotsChange(shots.filter((x) => x.id !== s.id))
    await removeScreenshot(entryId, s.id)
  }, [entryId, shots, onShotsChange])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ fontSize: 11, color: "var(--c-fg-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
          Chart screenshots
        </div>
        <span style={{ fontSize: 11.5, color: "var(--c-fg-muted)" }}>
          Drop in entry, exit, and any in-trade chart marks. Stored privately in your bucket.
        </span>
      </div>

      <label style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 6, padding: "24px 16px",
        border: "1px dashed var(--c-border-strong)",
        borderRadius: 10,
        background: "var(--c-bg-elev-2)",
        cursor: uploading ? "wait" : "pointer",
        color: "var(--c-fg-muted)",
        fontSize: 12.5,
      }}>
        <Icon name="plus" size={16} />
        <span>{uploading ? "Uploading…" : "Click to upload PNG / JPG"}</span>
        <input type="file" accept="image/*" onChange={onFileChange} disabled={uploading} style={{ display: "none" }} />
      </label>

      {error && (
        <div style={{ fontSize: 12, color: "var(--c-red-bright)", padding: 8, background: "var(--c-red-soft)", borderRadius: 8 }}>
          {error}
        </div>
      )}

      {shots.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
          {shots.map((s) => {
            const url = signedUrls[s.id]
            return (
              <div key={s.id} style={{
                position: "relative",
                borderRadius: 10,
                overflow: "hidden",
                background: "var(--c-bg-elev-2)",
                border: "1px solid var(--c-border)",
                aspectRatio: "16 / 10",
              }}>
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ display: "grid", placeItems: "center", height: "100%", color: "var(--c-fg-dim)", fontSize: 12 }}>
                    Loading…
                  </div>
                )}
                <button
                  onClick={() => onRemove(s)}
                  style={{
                    position: "absolute", top: 6, right: 6,
                    width: 24, height: 24,
                    background: "rgba(0,0,0,0.55)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 6,
                    color: "#fff", display: "grid", placeItems: "center",
                    cursor: "pointer",
                  }}
                  title="Remove"
                >
                  <Icon name="x" size={11} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
