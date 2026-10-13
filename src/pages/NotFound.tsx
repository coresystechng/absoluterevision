import { Link } from "react-router-dom"
import { PublicPageLayout } from "@/components/PublicPageLayout"
import { Button } from "@/components/ui/button"

export function NotFound() {
  return <PublicPageLayout><div className="mx-auto max-w-2xl py-12 text-center">
    <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">404 · Page not found</p>
    <h1 className="mt-5 text-4xl font-semibold">We couldn't find that page.</h1>
    <p className="mt-6 leading-7 text-muted-foreground">The link may have changed, or the page may no longer exist. You can return home or explore our editing services and pricing.</p>
    <div className="mt-8 flex flex-wrap justify-center gap-3"><Button asChild><Link to="/">Return home</Link></Button><Button asChild variant="outline"><Link to="/pricing">View pricing</Link></Button></div>
  </div></PublicPageLayout>
}
