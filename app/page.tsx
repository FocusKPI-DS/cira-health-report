'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './page.module.css'
import Header from '@/components/Header'
import AddDatasourceModal from '@/components/AddDatasourceModal'
import { LightningIcon, RobotIcon, ChartIcon, ClipboardIcon, TagIcon, RefreshIcon, CheckIcon } from '@/components/Icons'

// Google Analytics type declaration
declare global {
  interface Window {
    gtag?: (command: string, ...args: any[]) => void
  }
}

export default function Home() {
  const router = useRouter()
  const [productName, setProductName] = useState('')
  const [showAddDatasourceModal, setShowAddDatasourceModal] = useState(false)
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null)
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    message: ''
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (productName.trim()) {
      // Track try_it_for_free event in GA4
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'try_it_for_free', {
          product_name: productName.trim()
        })
      }
      
      router.push(`/generate?productName=${encodeURIComponent(productName)}`)
    }
  }

  const handleLogin = () => {
    // Navigate to login or show login modal
    router.push('/login')
  }

  return (
    <main className={styles.main} style={{ flex: 1 }}>
      <Header showAuthButtons={true} showNavMenu={true} />
      <div id="hero" className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.title}>
            Get Your First PHA Analysis Draft<br />
            <span className={styles.highlight}>In 30 Seconds </span>
          </h1>
          <p className={styles.subtitle}>
            Streamline your Process Hazard Analysis with AI-powered insights.<br />
            Generate comprehensive reports quickly and efficiently.
          </p>
          <form onSubmit={handleSubmit} className={styles.ctaForm}>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className={styles.productInput}
              placeholder="Enter your device name"
              required
            />
            <button type="submit" className={styles.ctaButton}>
              Try It for Free
              <span className={styles.arrow}>→</span>
            </button>
          </form>
          
          <div className={styles.features}>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>
                <LightningIcon />
              </div>
              <div className={styles.featureText}>Fast Analysis</div>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>
                <RobotIcon />
              </div>
              <div className={styles.featureText}>AI-Powered</div>
            </div>
            <div className={styles.feature}>
              <div className={styles.featureIcon}>
                <ChartIcon />
              </div>
              <div className={styles.featureText}>FDA Compliant</div>
            </div>
          </div>
        </div>
      </div>

      <div id="datasources" className={styles.datasourceSection}>
        <div className={styles.datasourceContainer}>
          <div className={styles.datasourceHeader}>
            <h2 className={styles.datasourceTitle}>Connected Data Sources</h2>
            <p className={styles.datasourceDescription}>
              Real-time access to comprehensive FDA databases
            </p>
            
            <button 
              className={styles.addDatasourceButton}
              onClick={() => {
                // Track click add datasource event in GA4
                if (typeof window !== 'undefined' && window.gtag) {
                  window.gtag('event', 'click_add_datasource', {
                    page: 'home'
                  })
                }
                setShowAddDatasourceModal(true)
              }}
            >
              Add Datasource
            </button>
          </div>
          
          <div className={styles.datasourceCard}>
            <div className={styles.datasourceCardHeader}>
              <div className={styles.fdaBadge}>FDA</div>
              <span className={styles.connectedStatus}>
                <span className={styles.statusDot}></span>
                Connected
              </span>
            </div>
            <div className={styles.datasourceList}>
              <div className={styles.datasourceItem}>
                <div className={styles.itemIcon}>
                  <ClipboardIcon />
                </div>
                <div className={styles.itemContent}>
                  <div className={styles.itemTitle}>MAUDE Database</div>
                  <div className={styles.itemDesc}>Manufacturer and User Facility Device Experience</div>
                </div>
              </div>
              <div className={styles.datasourceItem}>
                <div className={styles.itemIcon}>
                  <TagIcon />
                </div>
                <div className={styles.itemContent}>
                  <div className={styles.itemTitle}>Device Classification</div>
                  <div className={styles.itemDesc}>Comprehensive device categorization</div>
                </div>
              </div>
              <div className={styles.datasourceItem}>
                <div className={styles.itemIcon}>
                  <RefreshIcon />
                </div>
                <div className={styles.itemContent}>
                  <div className={styles.itemTitle}>Total Product Life Cycle</div>
                  <div className={styles.itemDesc}>Complete product lifecycle tracking</div>
                </div>
              </div>
              <div className={styles.datasourceItem}>
                <div className={styles.itemIcon}>
                  <CheckIcon />
                </div>
                <div className={styles.itemContent}>
                  <div className={styles.itemTitle}>510(k) Clearances</div>
                  <div className={styles.itemDesc}>Pre-market notification database</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="faq" className={styles.faqSection}>
        <div className={styles.faqContainer}>
          <h2 className={styles.faqTitle}>Frequently Asked Questions</h2>
          <p className={styles.faqDescription}>
            Everything you need to know about PHA Analysis
          </p>
          
          <div className={styles.faqList}>
            <div className={styles.faqItem}>
              <button
                className={styles.faqQuestion}
                onClick={() => setOpenFaqIndex(openFaqIndex === 0 ? null : 0)}
              >
                <span>What is a Process Hazard Analysis (PHA)?</span>
                <span className={styles.faqIcon}>{openFaqIndex === 0 ? '−' : '+'}</span>
              </button>
              {openFaqIndex === 0 && (
                <div className={styles.faqAnswer}>
                  A Process Hazard Analysis (PHA) is a systematic evaluation of potential hazards associated with industrial processes. It helps identify and assess risks, ensuring compliance with safety regulations and FDA requirements for medical devices.
                </div>
              )}
            </div>

            <div className={styles.faqItem}>
              <button
                className={styles.faqQuestion}
                onClick={() => setOpenFaqIndex(openFaqIndex === 1 ? null : 1)}
              >
                <span>How long does it take to generate a PHA report?</span>
                <span className={styles.faqIcon}>{openFaqIndex === 1 ? '−' : '+'}</span>
              </button>
              {openFaqIndex === 1 && (
                <div className={styles.faqAnswer}>
                  Our AI-powered platform can generate a comprehensive PHA analysis draft in just 30 seconds. You can then review, edit, and refine the report to meet your specific requirements.
                </div>
              )}
            </div>

            <div className={styles.faqItem}>
              <button
                className={styles.faqQuestion}
                onClick={() => setOpenFaqIndex(openFaqIndex === 2 ? null : 2)}
              >
                <span>What data sources does the platform use?</span>
                <span className={styles.faqIcon}>{openFaqIndex === 2 ? '−' : '+'}</span>
              </button>
              {openFaqIndex === 2 && (
                <div className={styles.faqAnswer}>
                  We integrate with comprehensive FDA databases including MAUDE (Manufacturer and User Facility Device Experience), Device Classification, Total Product Life Cycle (TPLC), and 510(k) Clearances to provide accurate and up-to-date information.
                </div>
              )}
            </div>

            <div className={styles.faqItem}>
              <button
                className={styles.faqQuestion}
                onClick={() => setOpenFaqIndex(openFaqIndex === 3 ? null : 3)}
              >
                <span>Is the generated report FDA compliant?</span>
                <span className={styles.faqIcon}>{openFaqIndex === 3 ? '−' : '+'}</span>
              </button>
              {openFaqIndex === 3 && (
                <div className={styles.faqAnswer}>
                  Yes, our reports are designed to meet FDA compliance requirements. The platform uses FDA-approved data sources and follows industry-standard PHA methodologies. However, we recommend having your quality assurance team review the final report.
                </div>
              )}
            </div>

            <div className={styles.faqItem}>
              <button
                className={styles.faqQuestion}
                onClick={() => setOpenFaqIndex(openFaqIndex === 4 ? null : 4)}
              >
                <span>Can I customize the generated reports?</span>
                <span className={styles.faqIcon}>{openFaqIndex === 4 ? '−' : '+'}</span>
              </button>
              {openFaqIndex === 4 && (
                <div className={styles.faqAnswer}>
                  Yes! While you cannot edit reports directly in the platform, you can export the generated reports to Excel format. Once exported, you can modify, add, or remove sections using your own tools to match your specific needs and company standards.
                </div>
              )}
            </div>

            <div className={styles.faqItem}>
              <button
                className={styles.faqQuestion}
                onClick={() => setOpenFaqIndex(openFaqIndex === 5 ? null : 5)}
              >
                <span>Do I need to create an account to use the service?</span>
                <span className={styles.faqIcon}>{openFaqIndex === 5 ? '−' : '+'}</span>
              </button>
              {openFaqIndex === 5 && (
                <div className={styles.faqAnswer}>
                  You can try the service for free without creating an account. However, creating an account allows you to save your reports, access your history, and enjoy additional features for managing multiple analyses.
                </div>
              )}
            </div>

            <div className={styles.faqItem}>
              <button
                className={styles.faqQuestion}
                onClick={() => setOpenFaqIndex(openFaqIndex === 6 ? null : 6)}
              >
                <span>Can I connect other datasources?</span>
                <span className={styles.faqIcon}>{openFaqIndex === 6 ? '−' : '+'}</span>
              </button>
              {openFaqIndex === 6 && (
                <div className={styles.faqAnswer}>
                  Yes! If you'd like to connect additional datasources beyond the current FDA databases, you can submit a request through the "Add Datasource" form on the homepage or contact us directly at cirahealth@focuskpi.com. We'll work with you to integrate your preferred data sources.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div id="contact" className={styles.contactSection}>
        <div className={styles.contactContainer}>
          <h2 className={styles.contactTitle}>Contact Us</h2>
          <p className={styles.contactDescription}>
            Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
          </p>
          <div className={styles.contactEmail}>
            <span className={styles.contactEmailLabel}>Email:</span>
            <a href="mailto:cirahealth@focuskpi.com" className={styles.contactEmailLink}>cirahealth@focuskpi.com</a>
          </div>
          
          <div className={styles.contactContent}>
            <form className={styles.contactForm} onSubmit={(e) => {
              e.preventDefault()
              // Handle form submission here
              console.log('Contact form submitted:', contactForm)
              alert('Thank you for your message! We will get back to you soon.')
              setContactForm({ name: '', email: '', message: '' })
            }}>
              <div className={styles.formGroup}>
                <label htmlFor="name" className={styles.formLabel}>Name</label>
                <input
                  type="text"
                  id="name"
                  className={styles.formInput}
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="email" className={styles.formLabel}>Email</label>
                <input
                  type="email"
                  id="email"
                  className={styles.formInput}
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="message" className={styles.formLabel}>Message</label>
                <textarea
                  id="message"
                  className={styles.formTextarea}
                  rows={5}
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  required
                />
              </div>
              <button type="submit" className={styles.contactSubmitButton}>
                Send Message
                <span className={styles.arrow}>→</span>
              </button>
            </form>
          </div>
        </div>
      </div>

      <AddDatasourceModal
        isOpen={showAddDatasourceModal}
        onClose={() => setShowAddDatasourceModal(false)}
      />
    </main>
  )
}

