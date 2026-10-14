import { describe, expect, it } from "vitest"
import { getNavigationDocument } from "./service-worker-routes"

describe("static navigation documents", () => {
  it.each([
    ["/", "index.html"], ["/pricing", "pricing.html"],
    ["/pricing///", "pricing.html"], ["/login", "_pages/login.html"],
    ["/sign-in/", "_pages/login.html"], ["/sign-up", "_pages/sign-up.html"],
    ["/dashboard///", "_pages/dashboard.html"], ["/settings", "_pages/settings.html"],
    ["/client-submissions", "_pages/client-submissions.html"],
    ["/document-upload", "_pages/document-upload.html"], ["/track-assignment", "_pages/track-assignment.html"],
    ["/assignments/42", "_pages/assignment.html"], ["/assignments/example///", "_pages/assignment.html"],
  ])("maps %s to %s", (pathname, document) => expect(getNavigationDocument(pathname)).toBe(document))

  it.each(["/api", "/api/assignments/42", "/unknown", "/assets/index.js", "/assignments", "/assignments/", "/assignments/42/files", "/assignments/a%2Fb", "/assignments/a%5cb", "/assignments/a\\b", "//pricing", "https://other.example/pricing"])("rejects %s", (pathname) => expect(getNavigationDocument(pathname)).toBeNull())

  it("uses only pathname, leaving synthetic private query data out of the document key", () => {
    const url = new URL("https://example.test/assignments/42?token=synthetic-private#private")
    expect(getNavigationDocument(url.pathname)).toBe("_pages/assignment.html")
    expect(getNavigationDocument("/dashboard?token=synthetic-private")).toBeNull()
  })
})
