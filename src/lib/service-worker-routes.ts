/** Map pathnames to revisioned, generic documents. Search data never enters keys. */
const navigationDocuments: Readonly<Record<string, string>> = {
  "/": "index.html",
  "/pricing": "pricing.html",
  "/login": "_pages/login.html",
  "/sign-in": "_pages/login.html",
  "/sign-up": "_pages/sign-up.html",
  "/document-upload": "_pages/document-upload.html",
  "/track-assignment": "_pages/track-assignment.html",
  "/dashboard": "_pages/dashboard.html",
  "/client-submissions": "_pages/client-submissions.html",
  "/settings": "_pages/settings.html",
}

export function getNavigationDocument(pathname: string): string | null {
  if (!pathname.startsWith("/") || pathname.startsWith("//") || /[%](?:2f|5c)|[\\?#]/i.test(pathname)) return null
  const normalized = pathname.replace(/\/+$/, "") || "/"
  if (Object.hasOwn(navigationDocuments, normalized)) return navigationDocuments[normalized]
  return /^\/assignments\/[^/]+$/.test(normalized) ? "_pages/assignment.html" : null
}
