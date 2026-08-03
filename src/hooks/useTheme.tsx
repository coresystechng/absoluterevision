import { useEffect, useMemo, useState } from "react"

import { ThemeContext } from "@/hooks/theme-context"
import type { ThemePreference } from "@/types"
const storageKey = "absolute-revision-theme"

function getInitialTheme(): ThemePreference {
  if (typeof window === "undefined") {
    return "system"
  }

  const stored = window.localStorage.getItem(storageKey)
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored
  }
  return "system"
}

function applyTheme(theme: ThemePreference) {
  const root = window.document.documentElement
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  const shouldUseDark = theme === "dark" || (theme === "system" && systemDark)

  root.classList.toggle("dark", shouldUseDark)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(getInitialTheme)

  useEffect(() => {
    const toggleTheme = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        !event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.key.toLowerCase() !== "t"
      ) {
        return
      }

      event.preventDefault()
      const isDark = window.document.documentElement.classList.contains("dark")
      setThemeState(isDark ? "light" : "dark")
    }

    window.addEventListener("keydown", toggleTheme)
    return () => window.removeEventListener("keydown", toggleTheme)
  }, [])

  useEffect(() => {
    applyTheme(theme)
    window.localStorage.setItem(storageKey, theme)

    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const listener = () => {
      if (theme === "system") {
        applyTheme("system")
      }
    }
    media.addEventListener("change", listener)
    return () => media.removeEventListener("change", listener)
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      setTheme: setThemeState,
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
