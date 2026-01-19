'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './page.module.css'
import Header from '@/components/Header'
import AddDatasourceModal from '@/components/AddDatasourceModal'
import { LightningIcon, RobotIcon, ChartIcon, ClipboardIcon, TagIcon, RefreshIcon, CheckIcon } from '@/components/Icons'

export default function Home() {
  const router = useRouter()
  const [productName, setProductName] = useState('')
  const [showAddDatasourceModal, setShowAddDatasourceModal] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (productName.trim()) {
      router.push(`/generate?productName=${encodeURIComponent(productName)}`)
    }
  }

  const handleLogin = () => {
    // Navigate to login or show login modal
    router.push('/login')
  }

  return (
    <main className={styles.main}>
      <Header showAuthButtons={true} />
      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.badge}>Powered by focuskpi</div>
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

      <div className={styles.datasourceSection}>
        <div className={styles.datasourceContainer}>
          <div className={styles.datasourceHeader}>
            <h2 className={styles.datasourceTitle}>Connected Data Sources</h2>
            <p className={styles.datasourceDescription}>
              Real-time access to comprehensive FDA databases
            </p>
            
            <button 
              className={styles.addDatasourceButton}
              onClick={() => setShowAddDatasourceModal(true)}
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

      <AddDatasourceModal
        isOpen={showAddDatasourceModal}
        onClose={() => setShowAddDatasourceModal(false)}
      />
    </main>
  )
}

