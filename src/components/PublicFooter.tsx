import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Mail } from "lucide-react"
import { ThemeToggle } from "@/components/ThemeToggle"
import { WhatsAppIcon } from "@/components/WhatsAppIcon"
import { businessContact, businessSocialProfiles } from "@/lib/public-business"
import privacyPolicyUrl from "../../assets/privacy.md?url"
import termsUrl from "../../assets/terms.md?url"
import logoImage from "../../img/icon.png"

const footerLinks = [
  { label: "Sign Up", href: "/sign-up" },
  { label: "Back To Top", href: "#top" },
  { label: "Get Started", href: "/document-upload" },
  { label: "Track assignment", href: "/track-assignment" },
]

const socialLinks = businessSocialProfiles

export function PublicFooter() {
  // Saved preferences are client-specific, so mount the controls after hydration.
  const [themeReady, setThemeReady] = useState(false)
  useEffect(() => setThemeReady(true), [])

  return (
    <footer className="px-4 py-12 bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 font-semibold">
            <img src={logoImage} alt="" className="h-8 w-8 object-contain" />
            <span>Absolute Revision</span>
          </div>
          <p className="mt-5 max-w-xl text-sm leading-6 text-primary-foreground/85">
            Providing high-quality editing, proofreading, and formatting services to researchers, authors, students, and businesses.
          </p>
          <div className="mt-4 grid gap-3 text-sm text-primary-foreground/85">
            <a href={businessContact.whatsappHref} className="inline-flex w-fit items-center gap-2 hover:underline">
              <WhatsAppIcon className="h-4 w-4 shrink-0" />
              {businessContact.phoneDisplay}
            </a>
            <a href={`mailto:${businessContact.email}`} className="inline-flex w-fit items-center gap-2 break-all hover:underline">
              <Mail aria-hidden="true" className="h-4 w-4 shrink-0" />
              {businessContact.email}
            </a>
          </div>
        </div>

        <div>
          <h3 className="font-semibold">Site Navigation</h3>
          <ul className="mt-4 grid gap-3 text-sm text-primary-foreground/85">
            {footerLinks.map((link) => (
              <li key={link.href}>
                {link.href.startsWith("#") ? (
                  <a href={link.href} className="transition-colors hover:underline">
                    {link.label}
                  </a>
                ) : (
                  <Link to={link.href} className="transition-colors hover:underline">
                    {link.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-semibold">Social Links</h3>
          <ul className="mt-4 grid gap-3 text-sm text-primary-foreground/85">
            {socialLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href} target="_blank" rel="noreferrer" className="transition-colors hover:underline">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-10 flex max-w-6xl flex-col gap-3 border-t border-primary-foreground/25 pt-6 text-sm text-primary-foreground/85 lg:flex-row lg:items-center lg:justify-between">
        <p>Copyright 2026 Absolute Revision. All rights reserved.</p>
        <div className="flex flex-wrap items-center gap-3">
          <a href={privacyPolicyUrl} target="_blank" rel="noreferrer" className="hover:underline">
            Privacy Policy
          </a>
          <a href={termsUrl} target="_blank" rel="noreferrer" className="hover:underline">
            Site Terms
          </a>
          <div className="h-10 min-w-[106px] text-foreground">
            {themeReady && <ThemeToggle iconsOnly />}
          </div>
        </div>
      </div>
    </footer>
  )
}
