import { Skeleton } from "@/components/ui/skeleton"

export function RoutePending({ label = "Loading your workspace" }: { label?: string }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card"><div className="mx-auto flex h-16 max-w-6xl items-center px-4"><Skeleton className="h-7 w-44" /></div></header>
      <main className="mx-auto grid max-w-6xl gap-5 px-4 py-6" aria-busy="true">
        <p className="sr-only" role="status">{label}</p>
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
      </main>
    </div>
  )
}
