import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function titleCase(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function clampProgress(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)))
}

export function getProgressBadgeStyle(progress: number) {
  const clampedProgress = clampProgress(progress)
  const start = [239, 68, 68] as const
  const middle = [234, 179, 8] as const
  const end = [34, 197, 94] as const

  const [colorA, colorB] = clampedProgress < 65
    ? [start, middle]
    : [middle, end]

  const ratio = clampedProgress < 65
    ? clampedProgress / 65
    : (clampedProgress - 65) / 35

  const t = Math.max(0, Math.min(1, ratio))
  const red = Math.round(colorA[0] + (colorB[0] - colorA[0]) * t)
  const green = Math.round(colorA[1] + (colorB[1] - colorA[1]) * t)
  const blue = Math.round(colorA[2] + (colorB[2] - colorA[2]) * t)
  const accent = `rgb(${red}, ${green}, ${blue})`
  const glow = `rgba(${red}, ${green}, ${blue}, 0.82)`
  const textColor = clampedProgress >= 70 ? "#052e16" : "#ffffff"

  return {
    background: `linear-gradient(135deg, ${accent} 0%, ${glow} 100%)`,
    borderColor: accent,
    color: textColor,
  }
}
