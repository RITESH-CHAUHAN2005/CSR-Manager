import { isProd } from '../config/env.js'

// Render's free tier spins the instance down after ~15 min of inactivity, which
// causes a ~50s cold start on the next request. To keep the app warm for the
// showcase/production demo, we self-ping the health endpoint on an interval so the
// instance never goes fully idle.
//
// URL resolution (first hit wins):
//   1. KEEP_ALIVE_URL  — explicit override (any host base, no trailing slash)
//   2. RENDER_EXTERNAL_URL — injected automatically by Render for the live service
// Disabled outside production, or when no public URL is known (e.g. local dev).
const PING_INTERVAL_MS = 10 * 60 * 1000 // 10 min < Render's 15 min idle window

export function startKeepAlive() {
  if (!isProd) return

  const base = (process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL || '')
    .trim()
    .replace(/\/+$/, '')
  if (!base) {
    console.log('ℹ️  Keep-alive disabled (no KEEP_ALIVE_URL / RENDER_EXTERNAL_URL set).')
    return
  }

  const healthUrl = `${base}/api/health`
  const timer = setInterval(() => {
    fetch(healthUrl)
      .then((r) => {
        if (!r.ok) console.warn(`keep-alive ping non-OK: ${r.status}`)
      })
      .catch((e) => console.warn('keep-alive ping failed:', (e as Error)?.message))
  }, PING_INTERVAL_MS)

  // Don't let the ping timer keep the process alive on shutdown.
  timer.unref?.()
  console.log(`💓 Keep-alive enabled — pinging ${healthUrl} every ${PING_INTERVAL_MS / 60000} min.`)
}
