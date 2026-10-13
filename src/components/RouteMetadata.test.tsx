import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Link, MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it } from "vitest"

import { RouteMetadata } from "./RouteMetadata"

function HeadNavigation() {
  return <>
    <RouteMetadata />
    <Link to="/">Home</Link>
    <Link to="/track-assignment?accessCode=private-test-value#private-fragment">Track</Link>
    <Link to="/assignments/987654">Assignment</Link>
  </>
}

describe("route metadata", () => {
  beforeEach(() => {
    document.head.querySelectorAll("[data-site-metadata], title").forEach((element) => element.remove())
  })

  it("updates indexing and social previews on navigation without duplicate or stale tags", async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><HeadNavigation /></MemoryRouter>)
    expect(document.title).toBe("Academic Editing & Proofreading | Absolute Revision")
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute("content", "index, follow, max-image-preview:large")

    await user.click(screen.getByRole("link", { name: "Track" }))
    expect(document.title).toBe("Track Your Assignment | Absolute Revision")
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow")
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute("href", "https://absoluterevision.com/track-assignment")
    expect(document.querySelector('meta[property="og:title"]')).toHaveAttribute("content", document.title)
    expect(document.head.innerHTML).not.toContain("private-test-value")
    expect(document.head.innerHTML).not.toContain("private-fragment")

    await user.click(screen.getByRole("link", { name: "Assignment" }))
    expect(document.title).toBe("Assignment | Absolute Revision")
    expect(document.querySelector('link[rel="canonical"]')).toBeNull()
    expect(document.querySelector('meta[property="og:url"]')).toBeNull()
    expect(document.head.innerHTML).not.toContain("987654")

    await user.click(screen.getByRole("link", { name: "Home" }))
    expect(document.title).toBe("Academic Editing & Proofreading | Absolute Revision")
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute("content", "index, follow, max-image-preview:large")
    for (const selector of ["title", 'meta[name="description"]', 'meta[name="robots"]', 'meta[property="og:title"]', 'meta[name="twitter:card"]', 'link[rel="canonical"]']) {
      expect(document.head.querySelectorAll(selector)).toHaveLength(1)
    }
  })
})
