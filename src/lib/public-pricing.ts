/** Approved service fees; VAT and transfer fees are excluded. */
export const editingPrices = [
  { name: "Assignments & essays", naira: 50000, dollars: 40, description: "Language editing, proofreading, referencing, and formatting for your assignment or essay." },
  { name: "BSc. dissertation", naira: 150000, dollars: 113, description: "Academic editing and proofreading for your undergraduate dissertation." },
  { name: "MSc. dissertation", naira: 200000, dollars: 150, description: "Academic editing and proofreading for your master's dissertation." },
] as const

export function formatDollarPrice(dollars: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(dollars)
}

export function formatNaira(naira: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(naira)
}
