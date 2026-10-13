import { PublicFooter } from "@/components/PublicFooter"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import logoImage from "../../img/icon.png"

export function PublicPageLayout({ children }: { children: ReactNode }) {
  return <div id="top" className="min-h-screen bg-background text-foreground">
    <header className="border-b bg-surface-raised">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 font-semibold"><img src={logoImage} width={32} height={32} alt="" />Absolute Revision</Link>
        <nav aria-label="Primary" className="flex items-center gap-4 text-sm">
          <Link to="/track-assignment" className="underline-offset-4 hover:underline">Track assignment</Link>
          <Button asChild size="sm"><Link to="/document-upload">Submit a manuscript</Link></Button>
        </nav>
      </div>
    </header>
    <main className="mx-auto max-w-6xl px-4 py-12 sm:py-20">{children}</main>
    <PublicFooter />
  </div>
}
