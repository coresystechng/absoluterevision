import type { FormEvent } from "react"
import { Link } from "react-router-dom"
import {
  Award,
  BookOpenCheck,
  ChevronDown,
  FileCheck2,
  FileText,
  GraduationCap,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

import privacyPolicyUrl from "../../assets/privacy.md?url"
import termsUrl from "../../assets/terms.md?url"
import heroImage from "../../img/hero-students.jpg"
import logoImage from "../../img/logo.png"
import partnerLogoOne from "../../img/prt-1.png"
import partnerLogoTwo from "../../img/prt-2.png"
import partnerLogoThree from "../../img/prt-3.png"
import partnerLogoFour from "../../img/prt-4.png"
import serviceImage from "../../img/slide (1).jpg"
import aboutImage from "../../img/stx-1.jpg"

const documentUploadUrl = "https://absoluterevision.com/document-upload/"
const supportEmail = "support@absoluterevision.com"
const phoneDisplay = "+1 937 249 0400"
const phoneHref = "tel:+19372490400"

const navLinks = [
  { label: "About", href: "#about" },
  { label: "Reviews", href: "#reviews" },
  { label: "Services", href: "#services" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: "#contact" },
]

const stats = [
  { value: "12,000+", label: "clients served globally" },
  { value: "25,000+", label: "documents edited" },
  { value: "50M+", label: "words revised" },
  { value: "4 days", label: "standard turnaround" },
]

const services = [
  {
    title: "Essays & Assignments",
    description:
      "Our editors help you score better grades by ensuring you submit impressive assignments and essays with polished language, referencing, and formatting.",
    icon: BookOpenCheck,
  },
  {
    title: "Dissertations, Thesis & Research Papers",
    description:
      "Our skilled editors make sure your thesis and research papers adhere to the highest standards of academic integrity, using ideal academic language, accurate referencing, and perfect formatting.",
    icon: GraduationCap,
  },
  {
    title: "Articles & Journals",
    description:
      "Our experienced editors assist you in creating articles that are flawlessly formatted, make an impact, and adhere to major magazines' and journals' requirements.",
    icon: FileText,
  },
]

const benefits = [
  {
    title: "Professional Editors",
    description:
      "We assign native English speakers who are experts in editing from your field of study or industry. Our editors are members of reputable editorial organizations, have years of editing experience, and hold advanced degrees from prestigious institutions in Australia, Europe, and North America.",
    icon: Award,
  },
  {
    title: "Top Tier Confidentiality",
    description:
      "Your files are treated with the utmost confidentiality. Files are accessed only by the managing editor and delegated editors, then removed from our system ten days after order completion. You can also send us a Non-Disclosure Agreement to sign.",
    icon: ShieldCheck,
  },
  {
    title: "Affordable to All",
    description:
      "Paying experts to edit and proofread your work does not have to be expensive. We provide writers, researchers, students, and businesses around the world with high-quality editorial services at competitive prices.",
    icon: WalletCards,
  },
  {
    title: "Free Revision",
    description:
      "We value our clients and guarantee the quality of our work. If reviewers recommend changes to your manuscript, we will proofread it for free. Request a free revision today.",
    icon: FileCheck2,
  },
]

const testimonials = [
  {
    name: "Shedrack Oche",
    quote:
      "I had an amazing experience working with your team. They went above and beyond to make sure I was happy with the final product.",
  },
  {
    name: "Fatima Muhammad",
    quote:
      "I was blown away by the quality of work and attention to detail provided by your team. I would highly recommend them to anyone.",
  },
  {
    name: "Francis Chukwuemeka",
    quote:
      "Working with your company was an absolute pleasure. Their communication and customer service was top-notch.",
  },
  {
    name: "Emmanuel Ese",
    quote:
      "Working with Absolute Revision was a delightful experience. Their communication and customer service were excellent.",
  },
]

const faqs = [
  {
    question: "What are your prices?",
    answer:
      "We have flat-rate pricing based on the word range of a document. View the pricing page for current pricing information.",
  },
  {
    question: "What file type is accepted?",
    answer: "Preferably, submit your manuscript in MS Word format.",
  },
  {
    question: "Do you have a money-back guarantee?",
    answer:
      "We work hard to ensure our clients are happy every time. If you are unsatisfied with the service and can cite fair justifications, we will provide a re-edit or issue a partial or full refund.",
  },
  {
    question: "Will my files be kept confidential?",
    answer:
      "Yes. We keep our clients' files in the strictest confidence and delete files from our system ten days after we complete the order.",
  },
  {
    question: "What's the turnaround time?",
    answer:
      "Our standard turnaround time is 4 days. There is an extra cost if you want the work completed in less than 4 days. Editing and proofreading a thesis, book, or novel may take longer, so feel free to discuss your deadline with us.",
  },
  {
    question: "Do you edit other documents?",
    answer:
      "We edit and proofread documents for businesses, academics, authors, and job applicants, including manuals, website content, annual reports, marketing material, research papers, thesis and dissertation work, journal articles, essays, admission essays, personal statements, assignments, books, magazine pieces, stories, scripts, poetry, novels, screenplays, self-help manuscripts, resumes, CVs, and cover letters.",
  },
  {
    question: "Can you translate and format articles?",
    answer:
      "Yes. We offer translation and formatting services. To place your order, please contact us.",
  },
]

const footerLinks = [
  { label: "Back To Top", href: "#top" },
  { label: "About Us", href: "#about" },
  { label: "Why Choose Us", href: "#why-choose" },
  { label: "Our Services", href: "#services" },
  { label: "Pricing", href: "/pricing.html" },
]

const socialLinks = [
  { label: "LinkedIn", href: "https://www.linkedin.com/company/absolute-revision/" },
  { label: "Telegram", href: "https://t.me/AbsoluteRevision" },
  { label: "Instagram", href: "https://Instagram.com/absoluterevision" },
]

const partnerLogos = [partnerLogoOne, partnerLogoTwo, partnerLogoThree, partnerLogoFour]

function submitContactForm(event: FormEvent<HTMLFormElement>) {
  event.preventDefault()

  const formData = new FormData(event.currentTarget)
  const name = String(formData.get("name") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim()
  const message = String(formData.get("message") ?? "").trim()
  const body = encodeURIComponent(
    [`Name: ${name}`, `Email: ${email}`, "", message].join("\n"),
  )

  window.location.href = `mailto:${supportEmail}?subject=Absolute%20Revision%20enquiry&body=${body}`
}

export function Landing() {
  return (
    <main id="top" className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <a href="#top" className="flex items-center gap-2 font-semibold">
            <img src={logoImage} alt="" className="h-8 w-8 object-contain" />
            <span>Absolute Revision</span>
          </a>

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex" aria-label="Primary">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="transition-colors hover:text-foreground">
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <a href={documentUploadUrl} target="_blank" rel="noreferrer">
                Get started
              </a>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative min-h-[78svh] overflow-hidden border-b">
        <img
          src={heroImage}
          alt="Students reviewing academic papers together"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/60" />

        <div className="relative mx-auto flex min-h-[78svh] max-w-6xl flex-col justify-center px-4 py-12 text-white sm:py-16">
          <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-md border border-white/25 bg-white/10 px-3 py-1 text-sm text-white/85 backdrop-blur">
            <ShieldCheck className="h-4 w-4" />
            Trusted academic editing, proofreading, and formatting
          </div>

          <h1 className="max-w-4xl text-3xl font-semibold tracking-normal text-white sm:text-5xl lg:text-6xl">
            High-Quality English Editing & Proofreading Services for Academic & Research Papers
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-7 text-white/82 sm:text-lg sm:leading-8">
            Are you planning to submit a report, essay, proposal, business document, or publish your article in a reputable journal or magazine? Our expert editors will edit and proofread your manuscript as soon as possible.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild className="bg-white text-black hover:bg-white/90">
              <a href={documentUploadUrl} target="_blank" rel="noreferrer">
                Get started
              </a>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="border-white/35 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              <a href="#contact">Contact us</a>
            </Button>
          </div>

          <div className="mt-8 flex flex-col gap-3 text-sm text-white/78 sm:flex-row sm:items-center">
            <a href={phoneHref} className="inline-flex items-center gap-2 transition-colors hover:text-white">
              <Phone className="h-4 w-4" />
              Call {phoneDisplay}
            </a>
            <span className="hidden h-1 w-1 rounded-full bg-white/60 sm:block" />
            <a
              href={`mailto:${supportEmail}`}
              className="inline-flex items-center gap-2 transition-colors hover:text-white"
            >
              <Mail className="h-4 w-4" />
              {supportEmail}
            </a>
          </div>
        </div>
      </section>

      <section className="border-y bg-muted/30">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border bg-card p-5">
              <p className="text-3xl font-semibold">{stat.value}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="about" className="scroll-mt-24 px-4 py-16 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="overflow-hidden rounded-lg border bg-muted">
            <img
              src={aboutImage}
              alt="Academic editing workspace"
              className="h-full min-h-[320px] w-full object-cover"
            />
          </div>

          <div className="flex flex-col justify-center">
            <p className="text-sm font-medium uppercase text-muted-foreground">About Us</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              Superior editing, proofreading, and formatting for serious manuscripts.
            </h2>
            <div className="mt-6 grid gap-4 text-base leading-7 text-muted-foreground">
              <p>
                Absolute Revision offers superior editing, proofreading, and formatting services to researchers, authors, students, and businesses. Absolute Revision has several years of experience serving 12,000+ clients globally.
              </p>
              <p>
                Because we value your manuscript and your confidence in us, we work hard to provide outstanding service every single time. We appoint professionals to revise and proofread your paper's language, and we support you if you require further help at no additional cost.
              </p>
              <p>
                Our expert editors are native English speakers who have earned advanced degrees from prestigious institutions in the UK, US, Australia, and Canada.
              </p>
            </div>
            <Button asChild className="mt-8 w-fit">
              <a href={documentUploadUrl} target="_blank" rel="noreferrer">
                Submit a manuscript
              </a>
            </Button>
          </div>
        </div>
      </section>

      <section id="reviews" className="scroll-mt-24 border-y bg-muted/30 px-4 py-16 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-medium uppercase text-muted-foreground">Our Story</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              Trusted and reliable around the world.
            </h2>
            <p className="mt-6 text-base leading-7 text-muted-foreground">
              With several years of experience and a worldwide catalog of clients, our performance and expertise are evident in the completed projects we have delivered so far. With over 25 thousand documents and 50 million words edited, we are trusted by clients around the world.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {partnerLogos.map((asset, index) => (
                <div key={asset} className="flex h-24 items-center justify-center rounded-lg border bg-card p-4">
                  <img
                    src={asset}
                    alt={`Featured partner mark ${index + 1}`}
                    className="max-h-14 object-contain"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {testimonials.map((testimonial) => (
              <Card key={testimonial.name}>
                <CardContent className="p-6">
                  <Sparkles className="h-5 w-5 text-muted-foreground" />
                  <p className="mt-5 text-sm leading-6 text-muted-foreground">
                    "{testimonial.quote}"
                  </p>
                  <p className="mt-5 font-semibold">{testimonial.name}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="why-choose" className="scroll-mt-24 px-4 py-16 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase text-muted-foreground">Why Choose Absolute Revision?</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              Editorial support built around quality, privacy, and practical deadlines.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {benefits.map((benefit) => {
              const Icon = benefit.icon
              return (
                <Card key={benefit.title}>
                  <CardHeader>
                    <div className="flex h-11 w-11 items-center justify-center rounded-md border bg-muted">
                      <Icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="pt-3">{benefit.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-6 text-muted-foreground">{benefit.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      <section id="services" className="scroll-mt-24 border-y bg-muted/30 px-4 py-16 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="flex flex-col justify-between gap-8">
            <div>
              <p className="text-sm font-medium uppercase text-muted-foreground">Services</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
                What service do you need?
              </h2>
              <p className="mt-5 text-base leading-7 text-muted-foreground">
                Send your essays, research papers, theses, dissertations, articles, journals, and business documents for expert language editing, proofreading, referencing, and formatting.
              </p>
            </div>

            <div className="overflow-hidden rounded-lg border bg-muted">
              <img
                src={serviceImage}
                alt="Editing notes on a printed document"
                className="h-[320px] w-full object-cover"
              />
            </div>
          </div>

          <div className="grid gap-4">
            {services.map((service) => {
              const Icon = service.icon
              return (
                <Card key={service.title}>
                  <CardContent className="grid gap-5 p-6 sm:grid-cols-[auto_1fr_auto] sm:items-start">
                    <div className="flex h-11 w-11 items-center justify-center rounded-md border bg-muted">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">{service.title}</h3>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">{service.description}</p>
                    </div>
                    <Button variant="outline" asChild className="w-fit">
                      <a href={documentUploadUrl} target="_blank" rel="noreferrer">
                        Get started
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      <section id="faq" className="scroll-mt-24 px-4 py-16 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-sm font-medium uppercase text-muted-foreground">Frequently Asked Questions</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal sm:text-4xl">
              Clear answers before you submit.
            </h2>

            <div className="mt-8 divide-y rounded-lg border bg-card">
              {faqs.map((faq) => (
                <details key={faq.question} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left font-medium [&::-webkit-details-marker]:hidden">
                    <span>{faq.question}</span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="px-5 pb-5 text-sm leading-6 text-muted-foreground">
                    {faq.answer}
                  </div>
                </details>
              ))}
            </div>
          </div>

          <Card id="contact" className="scroll-mt-24 self-start">
            <CardHeader>
              <div className="flex h-11 w-11 items-center justify-center rounded-md border bg-muted">
                <Mail className="h-5 w-5" />
              </div>
              <CardTitle className="pt-3">Contact Us</CardTitle>
              <CardDescription>
                Send a message by email or call us directly to discuss your document, deadline, and formatting requirements.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={submitContactForm}>
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" placeholder="Enter your name" autoComplete="name" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter your email"
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea id="message" name="message" placeholder="Enter your message" required />
                </div>
                <Button type="submit">Send</Button>
              </form>

              <Separator className="my-6" />

              <div className="grid gap-3 text-sm text-muted-foreground">
                <a href={phoneHref} className="inline-flex items-center gap-2 transition-colors hover:text-foreground">
                  <Phone className="h-4 w-4" />
                  {phoneDisplay}
                </a>
                <a
                  href={`mailto:${supportEmail}`}
                  className="inline-flex items-center gap-2 transition-colors hover:text-foreground"
                >
                  <Mail className="h-4 w-4" />
                  {supportEmail}
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="border-y bg-muted/30 px-4 py-14">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase text-muted-foreground">Ready to start?</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-normal">
              Get expert revision for your next submission.
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <a href={documentUploadUrl} target="_blank" rel="noreferrer">
                Submit manuscript
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href={phoneHref}>Call us</a>
            </Button>
          </div>
        </div>
      </section>

      <footer className="px-4 py-12">
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 font-semibold">
              <img src={logoImage} alt="" className="h-8 w-8 object-contain" />
              <span>Absolute Revision</span>
            </div>
            <p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground">
              With several years of experience serving clients worldwide, Absolute Revision provides high-quality editing, proofreading, and formatting services to researchers, authors, students, and businesses.
            </p>
            <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
              Our professional editors are native English speakers with advanced qualifications from top universities in the UK, US, Australia, and Canada.
            </p>
          </div>

          <div>
            <h3 className="font-semibold">Site Navigation</h3>
            <ul className="mt-4 grid gap-3 text-sm text-muted-foreground">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="transition-colors hover:text-foreground">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold">Social Links</h3>
            <ul className="mt-4 grid gap-3 text-sm text-muted-foreground">
              {socialLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} target="_blank" rel="noreferrer" className="transition-colors hover:text-foreground">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mx-auto mt-10 flex max-w-6xl flex-col gap-3 border-t pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Copyright 2026 Absolute Revision. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href={privacyPolicyUrl} target="_blank" rel="noreferrer" className="hover:text-foreground">
              Privacy Policy
            </a>
            <a href={termsUrl} target="_blank" rel="noreferrer" className="hover:text-foreground">
              Site Terms
            </a>
          </div>
        </div>
      </footer>
    </main>
  )
}
