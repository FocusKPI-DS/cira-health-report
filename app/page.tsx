'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import styles from './page.module.css'
import Header from '@/components/Header'
import { ClipboardIcon, TagIcon, RefreshIcon, CheckIcon } from '@/components/Icons'
import { trackEvent } from '@/lib/analytics'
import { useAuth } from '@/lib/auth'

const IMSC_CAMPAIGN_END = new Date('2026-06-30T23:59:59')
const CONTACT_EMAIL = 'info@focuskpi.ai'
const CONTACT_PHONE = '408-889-1014'

const FAQ_ITEMS = [
  {
    question: 'How much time does Cira Health save?',
    answer:
      'About 40 hours per analysis versus manual MAUDE work — downloading 500-record batches, pivot tables, and de-duplication. Teams of 3–5 often spend two or more full days by hand; Cira Health completes it in minutes.',
  },
  {
    question: 'Is it only for new products (PHA)?',
    answer:
      'No. Cira supports the full product lifecycle: new product PHA, risk file updates as new adverse events emerge, post-market surveillance, and any time you need a current, organized view of hazard data.',
  },
  {
    question: 'Can you customize it for our QMS and workflow?',
    answer:
      'Yes — that is our partnership model. We customize data sources (CAPAs, complaints, proprietary databases), workflow steps, output format (ISO 14971 tables, summaries, CSV), and UI. Contact us at info@focuskpi.ai to scope a Statement of Work.',
  },
  {
    question: 'How do we get started after the conference?',
    answer:
      'Submit the form on this page with your device name and work email — we will email your free risk report. You can also contact info@focuskpi.ai. After beta, we work with partners to tailor Cira to your QMS, workflow, and product portfolio.',
  },
]

function shouldShowImscBanner(searchParams: URLSearchParams): { show: boolean; reason?: 'date' | 'param' } {
  const source = searchParams.get('source')
  const imsc = searchParams.get('imsc')
  if (source === 'imsc' || imsc === '1') {
    return { show: true, reason: 'param' }
  }
  if (new Date() <= IMSC_CAMPAIGN_END) {
    return { show: true, reason: 'date' }
  }
  return { show: false }
}

function HomeContent() {
  const searchParams = useSearchParams()
  const [requestForm, setRequestForm] = useState({ name: '', email: '', device: '' })
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null)
  const { user, isAnonymous } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null)

  const imscBanner = shouldShowImscBanner(searchParams)

  useEffect(() => {
    if (imscBanner.show && imscBanner.reason) {
      trackEvent('landing_imsc_banner_shown', { reason: imscBanner.reason })
    }
  }, [imscBanner.show, imscBanner.reason])

  const handleReportRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setMessage(null)

    const device = requestForm.device.trim()
    const body = {
      name: requestForm.name.trim(),
      email: requestForm.email.trim(),
      message: [
        'Free medical device risk report request (landing page).',
        `Device: ${device}`,
        `Reply-to email: ${requestForm.email.trim()}`,
        imscBanner.show ? 'Source: IMSC / conference' : null,
      ]
        .filter(Boolean)
        .join('\n'),
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'
      const token = user ? await user.getIdToken() : null

      const response = await fetch(`${apiUrl}/api/v1/anonclient/contactus/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        trackEvent('booth_report_request', { device: device || undefined })
        setMessage({
          text: 'Thank you — we will email your free risk report shortly.',
          isError: false,
        })
        setRequestForm({ name: '', email: '', device: '' })
      } else {
        const errorData = await response.json().catch(() => ({}))
        setMessage({
          text: `Failed to submit: ${errorData.detail || 'Please try again.'}`,
          isError: true,
        })
      }
    } catch {
      setMessage({
        text: 'An error occurred. Please try again or email info@focuskpi.ai.',
        isError: true,
      })
    } finally {
      setSubmitting(false)
      setTimeout(() => setMessage(null), 6000)
    }
  }

  return (
    <main className={styles.main}>
      <Header
        showAuthButtons={!user || isAnonymous}
        showUserMenu={!!(user && !isAnonymous)}
        showNavMenu
        hideEnterpriseButton
      />

      <section id="hero" className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroBadges}>
            {imscBanner.show && (
              <p className={styles.imscBanner}>
                IMSC attendees — free report as at our booth
              </p>
            )}
            <p className={styles.eyebrow}>
              ISO 14971 / 24971 aligned
            </p>
          </div>

          <h1 className={styles.heroHeadline}>
            <span className={styles.statNumber}>40+</span> hours of risk analysis saved
          </h1>
          <p className={styles.subtitle}>
            Full product lifecycle — PHA, risk file updates, and post-market surveillance
          </p>

          <div className={styles.ctaBlock}>
            <p className={styles.ctaLabel}>Request your free medical device risk report</p>
            <p className={styles.ctaHint}>
              Share your details below — we&apos;ll run the analysis and email your report.
            </p>
            <form onSubmit={handleReportRequest} className={styles.requestForm}>
              <input
                type="text"
                value={requestForm.name}
                onChange={(e) => setRequestForm({ ...requestForm, name: e.target.value })}
                className={styles.formInput}
                placeholder="Name"
                required
              />
              <input
                type="email"
                value={requestForm.email}
                onChange={(e) => setRequestForm({ ...requestForm, email: e.target.value })}
                className={styles.formInput}
                placeholder="Work email"
                required
              />
              <input
                type="text"
                value={requestForm.device}
                onChange={(e) => setRequestForm({ ...requestForm, device: e.target.value })}
                className={styles.formInput}
                placeholder="Device / product name"
                required
              />
              <button type="submit" className={styles.ctaButton} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Request my free report'}
                {!submitting && <span className={styles.arrow}>→</span>}
              </button>
            </form>
            {message && (
              <div
                className={`${styles.feedback} ${message.isError ? styles.feedbackError : styles.feedbackSuccess}`}
              >
                {message.text}
              </div>
            )}
          </div>

          <div id="how-it-works" className={styles.pillars}>
            <article className={styles.pillar}>
              <div className={styles.pillarHead}>
                <div className={styles.pillarIcon}>
                  <RefreshIcon />
                </div>
                <h3 className={styles.pillarTitle}>Retrieve</h3>
              </div>
              <p className={styles.pillarDesc}>
                Pull MAUDE, FDA code sets, and IMDRF automatically — no manual compiling.
              </p>
            </article>
            <article className={styles.pillar}>
              <div className={styles.pillarHead}>
                <div className={styles.pillarIcon}>
                  <ClipboardIcon />
                </div>
                <h3 className={styles.pillarTitle}>Summarize</h3>
              </div>
              <p className={styles.pillarDesc}>
                AI summarizes evidence and ranks risks with traceable sources.
              </p>
            </article>
            <article className={styles.pillar}>
              <div className={styles.pillarHead}>
                <div className={styles.pillarIcon}>
                  <CheckIcon />
                </div>
                <h3 className={styles.pillarTitle}>Output</h3>
              </div>
              <p className={styles.pillarDesc}>
                FDA-aligned severity assessments, ready for your risk file.
              </p>
            </article>
          </div>

          <p className={styles.trustStrip}>
            Co-developed with regulatory domain experts · AI product developed by FocusKPI
          </p>
        </div>
      </section>

      <section id="why-cira" className={styles.compareSection}>
        <div className={styles.sectionInner}>
          <span className={styles.sectionKicker}>Compare</span>
          <h2 className={styles.sectionTitle}>Why Cira Health — not general AI</h2>
          <p className={styles.sectionDesc}>
            General tools lack comprehensive FDA/IMDRF access and regulatory domain expertise for ISO 14971-ready outputs.
          </p>
          <div className={styles.compareGrid}>
            <div className={`${styles.compareCard} ${styles.compareMuted}`}>
              <h3>General AI (e.g. ChatGPT)</h3>
              <ul className={styles.compareList}>
                <li>No direct MAUDE or IMDRF database access</li>
                <li>Manual paste-in; no traceability to source records</li>
                <li>Limited RA/QA framing for hazardous situations and severity</li>
              </ul>
            </div>
            <div className={`${styles.compareCard} ${styles.compareHighlight}`}>
              <h3>Cira Health</h3>
              <ul className={styles.compareList}>
                <li>Automated MAUDE, FDA code sets, and IMDRF</li>
                <li>Evidence ranked and traceable to source data</li>
                <li>Co-developed with RA/QA experts for ISO 14971 / 24971 workflows</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="data-sources" className={styles.sourcesSection}>
        <div className={styles.sectionInner}>
          <span className={styles.sectionKicker}>Integrations</span>
          <h2 className={styles.sectionTitle}>Data sources</h2>
          <p className={styles.sectionDesc}>
            Three primary public sources, with optional custom sources via partnership.
          </p>
          <div className={styles.sourcesGrid}>
            <div className={styles.sourceCard}>
              <div className={styles.sourceIcon}>
                <ClipboardIcon />
              </div>
              <h3>FDA MAUDE</h3>
              <p>Full narrative medical device reports — manufacturer and user facility experience.</p>
            </div>
            <div className={styles.sourceCard}>
              <div className={styles.sourceIcon}>
                <TagIcon />
              </div>
              <h3>FDA adverse event code sets</h3>
              <p>Device problem, patient problem, and product codes for structured analysis.</p>
            </div>
            <div className={styles.sourceCard}>
              <div className={styles.sourceIcon}>
                <RefreshIcon />
              </div>
              <h3>IMDRF terminology</h3>
              <p>Harmonized terminology for international market alignment.</p>
            </div>
          </div>
          <p className={styles.sourcesNote}>
            Need CAPAs, complaints, or proprietary databases?{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>Contact us</a> for customization add-ons.
          </p>
        </div>
      </section>

      <section id="faq" className={styles.faqSection}>
        <div className={styles.sectionInnerNarrow}>
          <span className={styles.sectionKicker}>Support</span>
          <h2 className={styles.sectionTitle}>Frequently asked questions</h2>
          <div className={styles.faqList}>
            {FAQ_ITEMS.map((item, index) => (
              <div
                key={item.question}
                className={`${styles.faqItem} ${openFaqIndex === index ? styles.faqItemOpen : ''}`}
              >
                <button
                  type="button"
                  className={styles.faqQuestion}
                  onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                >
                  <span>{item.question}</span>
                  <span className={styles.faqIcon}>{openFaqIndex === index ? '−' : '+'}</span>
                </button>
                {openFaqIndex === index && <div className={styles.faqAnswer}>{item.answer}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className={styles.contactSection}>
        <div className={styles.sectionInnerNarrow}>
          <div className={styles.contactCard}>
            <span className={styles.sectionKicker}>Get in touch</span>
            <h2 className={styles.sectionTitle}>Contact us</h2>
            <p className={styles.contactLead}>
              Partnership and customization · free risk reports for qualified devices
            </p>
            <div className={styles.contactDetails}>
              <a href={`mailto:${CONTACT_EMAIL}`} className={styles.contactLink}>
                {CONTACT_EMAIL}
              </a>
              <a href={`tel:${CONTACT_PHONE.replace(/[^\d+]/g, '')}`} className={styles.contactLink}>
                {CONTACT_PHONE}
              </a>
            </div>
            <p className={styles.customizationNote}>Customization add-ons available</p>
          </div>
        </div>
      </section>
    </main>
  )
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className={styles.main}>
          <div className={styles.hero}>
            <div className={styles.heroContent}>Loading…</div>
          </div>
        </main>
      }
    >
      <HomeContent />
    </Suspense>
  )
}
