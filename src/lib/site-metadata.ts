import { businessContact, businessSocialProfiles } from "./public-business"

/** Public brand data shared by the HTML build and client-side navigation. */
export const siteMetadata = {
  name: "Absolute Revision",
  origin: "https://absoluterevision.com",
  title: "Academic Editing & Proofreading | Absolute Revision",
  description:
    "Professional academic editing, proofreading, referencing, and formatting for essays, dissertations, research papers, and journal manuscripts.",
  imagePath: "/social/absolute-revision.png",
  imageAlt: "Absolute Revision — academic editing, proofreading, and formatting. Your ideas, clearly expressed.",
} as const

export const publicPages = {
  "/": { title: siteMetadata.title, description: siteMetadata.description },
  "/pricing": {
    title: "Editing & Proofreading Prices | Absolute Revision",
    description: "View editing and proofreading prices for assignments, essays, BSc. and MSc. dissertations, plus custom quotes for journal and magazine manuscripts.",
  },
} as const

export const utilityPages = {
  "/login": { title: "Sign In", description: "Sign in to your Absolute Revision workspace." },
  "/sign-in": { title: "Sign In", description: "Sign in to your Absolute Revision workspace." },
  "/sign-up": { title: "Create an Account", description: "Create your invited Absolute Revision workspace account." },
  "/document-upload": { title: "Submit Your Manuscript", description: "Securely submit your manuscript to Absolute Revision for editing and proofreading." },
  "/track-assignment": { title: "Track Your Assignment", description: "Check your assignment progress securely with your reference and private access code." },
  "/dashboard": { title: "Dashboard", description: "Manage your assignments in your Absolute Revision workspace." },
  "/client-submissions": { title: "Client Submissions", description: "Review client submissions in your Absolute Revision workspace." },
  "/settings": { title: "Settings", description: "Manage your Absolute Revision account and workspace settings." },
} as const

export type PageMetadata = {
  title: string
  description: string
  robots: string
  canonical?: string
}

export function getPageMetadata(pathname: string): PageMetadata {
  // Query strings and fragments can contain private details. Never publish them.
  const path = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/"
  const publicPath = path === "/index.html" ? "/" : path
  if (Object.prototype.hasOwnProperty.call(publicPages, publicPath)) {
    const page = publicPages[publicPath as keyof typeof publicPages]
    return {
      title: page.title,
      description: page.description,
      robots: "index, follow, max-image-preview:large",
      canonical: `${siteMetadata.origin}${publicPath}`,
    }
  }

  if (Object.prototype.hasOwnProperty.call(utilityPages, path)) {
    const page = utilityPages[path as keyof typeof utilityPages]
    return {
      title: `${page.title} | ${siteMetadata.name}`,
      description: page.description,
      robots: "noindex, nofollow",
      canonical: `${siteMetadata.origin}${path === "/sign-in" ? "/login" : path}`,
    }
  }

  // One static shell serves all private assignments. Do not publish an invented
  // canonical destination, assignment IDs, titles, or client details in its head.
  return {
    title: `${path.startsWith("/assignments/") ? "Assignment" : "Page Not Found"} | ${siteMetadata.name}`,
    description: "Your private Absolute Revision workspace.",
    robots: "noindex, nofollow",
  }
}

export type MetadataTag = {
  tag: "title" | "meta" | "link" | "script"
  attributes: Record<string, string>
  text?: string
}

export function getMetadataTags(page: PageMetadata): MetadataTag[] {
  const imageUrl = `${siteMetadata.origin}${siteMetadata.imagePath}`
  const tags: MetadataTag[] = [
    { tag: "title", attributes: {}, text: page.title },
    { tag: "meta", attributes: { name: "description", content: page.description } },
    { tag: "meta", attributes: { name: "robots", content: page.robots } },
    { tag: "meta", attributes: { property: "og:type", content: "website" } },
    { tag: "meta", attributes: { property: "og:site_name", content: siteMetadata.name } },
    { tag: "meta", attributes: { property: "og:title", content: page.title } },
    { tag: "meta", attributes: { property: "og:description", content: page.description } },
    { tag: "meta", attributes: { property: "og:image", content: imageUrl } },
    { tag: "meta", attributes: { property: "og:image:type", content: "image/png" } },
    { tag: "meta", attributes: { property: "og:image:width", content: "1200" } },
    { tag: "meta", attributes: { property: "og:image:height", content: "630" } },
    { tag: "meta", attributes: { property: "og:image:alt", content: siteMetadata.imageAlt } },
    { tag: "meta", attributes: { name: "twitter:card", content: "summary_large_image" } },
    { tag: "meta", attributes: { name: "twitter:title", content: page.title } },
    { tag: "meta", attributes: { name: "twitter:description", content: page.description } },
    { tag: "meta", attributes: { name: "twitter:image", content: imageUrl } },
    { tag: "meta", attributes: { name: "twitter:image:alt", content: siteMetadata.imageAlt } },
  ]

  if (page.canonical) {
    tags.push(
      { tag: "link", attributes: { rel: "canonical", href: page.canonical } },
      { tag: "meta", attributes: { property: "og:url", content: page.canonical } },
    )
  }
  if (page.robots.startsWith("index") && page.canonical) {
    const origin = siteMetadata.origin
    const schema = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization", "@id": `${origin}/#organization`,
          name: siteMetadata.name, url: `${origin}/`, description: siteMetadata.description,
          logo: `${origin}/icons/pwa-512x512.png`,
          email: businessContact.email,
          sameAs: businessSocialProfiles.map((profile) => profile.href),
          contactPoint: { "@type": "ContactPoint", contactType: "Customer service", email: businessContact.email, url: businessContact.whatsappHref },
        },
        { "@type": "WebSite", "@id": `${origin}/#website`, url: `${origin}/`, name: siteMetadata.name, inLanguage: "en", publisher: { "@id": `${origin}/#organization` } },
        { "@type": "WebPage", "@id": `${page.canonical}#webpage`, url: page.canonical, name: page.title, description: page.description, isPartOf: { "@id": `${origin}/#website` }, about: { "@id": `${origin}/#organization` } },
      ],
    }
    tags.push({ tag: "script", attributes: { type: "application/ld+json" }, text: JSON.stringify(schema).replace(/</g, "\\u003c") })
  }
  return tags
}
