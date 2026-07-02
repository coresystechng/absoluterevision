import { Monitor, Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useTheme } from "@/hooks/theme-context"
import type { ThemePreference } from "@/types"

const options: Array<{ value: ThemePreference; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
]

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme()

  if (compact) {
    const currentIndex = options.findIndex((option) => option.value === theme)
    const CurrentIcon = options[currentIndex]?.icon ?? Monitor
    const next = options[(currentIndex + 1) % options.length]
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Theme: ${theme}. Switch to ${next.label}`}
        onClick={() => setTheme(next.value)}
      >
        <CurrentIcon className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <div className="inline-flex rounded-md border bg-background p-1" role="group" aria-label="Theme preference">
      {options.map((option) => {
        const Icon = option.icon
        return (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={theme === option.value ? "secondary" : "ghost"}
            onClick={() => setTheme(option.value)}
            aria-pressed={theme === option.value}
          >
            <Icon className="h-4 w-4" />
            {option.label}
          </Button>
        )
      })}
    </div>
  )
}
