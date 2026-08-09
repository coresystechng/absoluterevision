import { cn } from "@/lib/utils"

export function DetailPageLayout({ header, primary, rail, stickyRail = true }: { header: React.ReactNode; primary: React.ReactNode; rail: React.ReactNode; stickyRail?: boolean }) {
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6">
      <header>{header}</header>
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:items-start">
        <section aria-label="Assignment workspace" className="grid min-w-0 gap-6">{primary}</section>
        <aside aria-label="Assignment context" className={cn("grid min-w-0 gap-6", stickyRail && "lg:sticky lg:top-20")}>{rail}</aside>
      </div>
    </main>
  )
}
