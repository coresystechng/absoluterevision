import { useEffect, useState } from "react"
import { getNewClientSubmissionsCount } from "@/api/client-submissions"

export function useNewSubmissionsCount(userId: string, enabled: boolean) {
  const [result, setResult] = useState<{ userId: string; count: number } | null>(null)

  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    let loading = false
    const refresh = async () => {
      if (loading || document.visibilityState === "hidden") return
      loading = true
      try {
        const { count } = await getNewClientSubmissionsCount(controller.signal)
        if (!controller.signal.aborted) setResult({ userId, count })
      } catch {
        // A failed refresh must not present an old count as current.
        if (!controller.signal.aborted) setResult(null)
      } finally { loading = false }
    }
    void refresh()
    const interval = window.setInterval(() => void refresh(), 60_000)
    const onVisible = () => { void refresh() }
    window.addEventListener("focus", onVisible)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      controller.abort()
      window.clearInterval(interval)
      window.removeEventListener("focus", onVisible)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [userId, enabled])

  return enabled && result?.userId === userId ? result.count : null
}
