import { Link } from "react-router-dom"
import { PublicPageLayout } from "@/components/PublicPageLayout"
import { Button } from "@/components/ui/button"
import { businessContact } from "@/lib/public-business"
import { editingPrices, formatDollarPrice, formatNaira } from "@/lib/public-pricing"

export function Pricing() {
  return <PublicPageLayout>
    <div className="max-w-3xl">
      <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">Clear pricing for your next paper.</h1>
      <p className="mt-6 text-lg leading-8 text-muted-foreground">Choose the service that fits your project. All prices exclude VAT and transfer fees.*</p>
    </div>
    <section aria-label="Editing prices" className="mt-10 grid gap-5 md:grid-cols-3">
      {editingPrices.map((price) => <article key={price.name} className="flex flex-col rounded-xl border bg-surface-raised p-6 sm:p-8">
        <h2 className="text-xl font-semibold">{price.name}</h2>
        <p className="mt-6 text-4xl font-semibold tabular-nums">{formatDollarPrice(price.dollars)}<span className="ml-2 text-sm font-normal text-muted-foreground">USD</span></p>
        <p className="mt-2 text-sm text-muted-foreground">  {formatNaira(price.naira)}</p>
        <p className="mt-6 flex-1 leading-7 text-muted-foreground">{price.description}</p>
        <Button asChild className="mt-8"><Link to="/document-upload">Submit your manuscript</Link></Button>
      </article>)}
    </section>
    <section aria-labelledby="custom-pricing" className="mt-6 rounded-xl border bg-muted/30 p-6 sm:p-8">
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
        <div><h2 id="custom-pricing" className="text-2xl font-semibold">Custom projects & papers</h2><p className="mt-3 max-w-2xl leading-7 text-muted-foreground">We offer custom pricing for specific requests not listed in the pricing above. Tell us about your document, requirements, and deadline so we can prepare a quote.</p></div>
        <Button asChild variant="outline" className="shrink-0"><a href={`mailto:${businessContact.email}?subject=Journal%20or%20magazine%20editing%20quote`}>Request a quote</a></Button>
      </div>
    </section>
    <div className="mt-12 grid gap-8 border-t pt-8 md:grid-cols-2">
      <section aria-labelledby="payment-note"><h2 id="payment-note" className="text-xl font-semibold">* VAT & transfer fees</h2><p className="mt-5 text-sm leading-7 text-muted-foreground">The listed amounts are service fees. VAT and bank or payment-provider transfer fees are excluded. We will confirm any applicable VAT and transfer fees with you before payment.</p></section>
    </div>
  </PublicPageLayout>
}
