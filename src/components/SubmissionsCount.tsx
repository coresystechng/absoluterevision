export function SubmissionsCount({ count }: { count: number | null | undefined }) {
  if (count == null || count <= 0) return null
  return (
    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold tabular-nums text-primary-foreground">
      <span aria-hidden="true">{count > 99 ? "99+" : count}</span>
      <span className="sr-only">{count} new submissions awaiting conversion</span>
    </span>
  )
}
