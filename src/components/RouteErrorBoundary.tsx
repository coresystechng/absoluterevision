import { Component, type ReactNode } from "react"
import { StatePanel } from "@/components/StatePanel"

export class RouteErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }

  render() {
    if (this.state.failed) return <main className="mx-auto max-w-3xl px-4 py-16"><StatePanel tone="error" title="This page could not be loaded" description="Reload the page to try again." primaryAction={{ label: "Reload page", onClick: () => window.location.reload() }} /></main>
    return this.props.children
  }
}
