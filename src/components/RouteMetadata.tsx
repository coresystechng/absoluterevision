import { useEffect } from "react"
import { useLocation } from "react-router-dom"

import { getMetadataTags, getPageMetadata } from "@/lib/site-metadata"

/** Keep the build-generated head in sync with SPA navigation, without private data. */
export function RouteMetadata() {
  const { pathname } = useLocation()

  useEffect(() => {
    document.head.querySelectorAll("[data-site-metadata]").forEach((element) => element.remove())
    for (const { tag, attributes, text } of getMetadataTags(getPageMetadata(pathname))) {
      const element = document.createElement(tag)
      element.setAttribute("data-site-metadata", "")
      for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)
      if (text) element.textContent = text
      document.head.append(element)
    }
  }, [pathname])

  return null
}
