'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from './page.module.css'
import SignInModal from '@/components/SignInModal'
import PaymentModal from '@/components/PaymentModal'
import PHADetailsModal from '@/components/PHADetailsModal'
import UserMenu from '@/components/UserMenu'
import GenerateWorkflowModal from '@/components/GenerateWorkflowModal'
import AddDatasourceModal from '@/components/AddDatasourceModal'
import { InfoIcon, DownloadIcon } from '@/components/Icons'

interface Hazard {
  hazard: string
  potentialHarm: string
  severity: string[]
}

interface HazardousSituation {
  id: string
  situation: string
  severityReasoning: string
  referenceLink?: string
}

interface PHADetails {
  hazard: string
  potentialHarm: string
  severity: string[]
  hazardousSituations: HazardousSituation[]
}

interface Report {
  id: string
  productName: string
  intendedUse: string
  createdAt: string
  hazardCount: number
}

function ResultsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [productName, setProductName] = useState('')
  const [intendedUse, setIntendedUse] = useState('')
  const [showSignInModal, setShowSignInModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showPHADetailsModal, setShowPHADetailsModal] = useState(false)
  const [selectedHazard, setSelectedHazard] = useState<PHADetails | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [showAddDatasourceModal, setShowAddDatasourceModal] = useState(false)
  const [currentHazards, setCurrentHazards] = useState<Hazard[]>([])
  const [reports, setReports] = useState<Report[]>([
    {
      id: '1',
      productName: 'Syringe',
      intendedUse: 'Medical device for injection of medications',
      createdAt: '2024-01-15',
      hazardCount: 8
    }
  ])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  useEffect(() => {
    const product = searchParams.get('productName') || ''
    const use = searchParams.get('intendedUse') || ''
    const loggedInParam = searchParams.get('loggedIn')
    const generatingParam = searchParams.get('generating')
    if (product) {
      setProductName(product)
    }
    if (use) {
      setIntendedUse(use)
    }
    // If coming from reports page, user is already logged in
    if (loggedInParam === 'true') {
      setIsLoggedIn(true)
    }
    // If generating flag is present, show generating state
    if (generatingParam === 'true') {
      setIsLoggedIn(true)
      setIsGenerating(true)
      // Remove the generating param from URL after a delay
      setTimeout(() => {
        setIsGenerating(false)
        const params = new URLSearchParams(searchParams.toString())
        params.delete('generating')
        router.replace(`/results?${params.toString()}`)
      }, 3000) // Show generating state for 3 seconds
    }
  }, [searchParams, router])

  const handleViewReport = (report: Report) => {
    router.push(`/results?productName=${encodeURIComponent(report.productName)}&intendedUse=${encodeURIComponent(report.intendedUse)}&loggedIn=true`)
  }

  // All hazard data
  const allHazards: Hazard[] = [
    {
      hazard: 'Crack',
      potentialHarm: 'Insufficient Information',
      severity: ['Minor', 'Negligible']
    },
    {
      hazard: 'No Clinical Signs, Symptoms or Conditions',
      potentialHarm: 'Insufficient Information',
      severity: ['Minor', 'Negligible']
    },
    {
      hazard: 'No Patient Involvement',
      potentialHarm: 'Insufficient Information',
      severity: ['Minor', 'Negligible']
    },
    {
      hazard: 'No Consequences Or Impact To Patient',
      potentialHarm: 'Insufficient Information',
      severity: ['Negligible']
    },
    {
      hazard: 'No Known Impact Or Consequence To Patient',
      potentialHarm: 'Insufficient Information',
      severity: ['Minor', 'Negligible']
    },
    {
      hazard: 'Battery Malfunction',
      potentialHarm: 'Device Failure',
      severity: ['Moderate']
    },
    {
      hazard: 'Software Error',
      potentialHarm: 'Incorrect Data Display',
      severity: ['Minor', 'Moderate']
    },
    {
      hazard: 'Electrical Hazard',
      potentialHarm: 'Patient Shock Risk',
      severity: ['Critical']
    }
  ]

  // Show only first hazard if not logged in, all if logged in
  const hazards = isLoggedIn ? allHazards : [allHazards[0]]

  const handleViewMore = () => {
    setShowSignInModal(true)
  }

  const handleCloseModal = () => {
    setShowSignInModal(false)
  }

  const handleSignInSuccess = () => {
    setIsLoggedIn(true)
    setShowSignInModal(false)
  }

  const handleDownload = () => {
    setShowPaymentModal(true)
  }

  const handleClosePayment = () => {
    setShowPaymentModal(false)
  }

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false)
    // Trigger download
    alert('Download starting... (In production, this would download the full report)')
  }

  const handleInfoClick = (hazard: Hazard, severity: string) => {
    // Create PHADetails from hazard with mock hazardous situations
    const phaDetails: PHADetails = {
      hazard: hazard.hazard,
      potentialHarm: hazard.potentialHarm,
      severity: [severity], // Only show the selected severity
      hazardousSituations: [
        {
          id: '1',
          situation: 'The user experienced a device that could not maintain a charge, leading to uncertainty about its operational status.',
          severityReasoning: 'The device was physically damaged and unable to hold a charge, which could lead to inconvenience and temporary issues but did not result in any reported injuries requiring medical intervention.',
          referenceLink: 'https://www.fda.gov/medical-devices/device-advice-comprehensive-regulatory-assistance/medical-device-databases'
        }
      ]
    }
    setSelectedHazard(phaDetails)
    setShowPHADetailsModal(true)
  }

  return (
    <main className={styles.main}>
      <div className={styles.navbar}>
        <div className={styles.navContainer}>
          <Link href="/" className={styles.logo}>Cira Health</Link>
          <div className={styles.navActions}>
            {isLoggedIn ? (
              <UserMenu />
            ) : (
              <>
                <button 
                  className={styles.enterpriseButton}
                  onClick={() => {}}
                >
                  Go to Enterprise Version
                </button>
                <button 
                  className={styles.loginButton}
                  onClick={() => router.push('/login')}
                >
                  Login / Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <div className={styles.pageContent}>
        {isLoggedIn && (
          <div className={styles.sidebarWrapper}>
            <div className={`${styles.sidebar} ${!isSidebarExpanded ? styles.sidebarCollapsed : ''}`}>
              <div className={styles.sidebarHeader}>
                <h2 className={styles.sidebarTitle}>Report History</h2>
                <button 
                  className={styles.sidebarToggle}
                  onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                  aria-label={isSidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
                >
                  {isSidebarExpanded ? '←' : '→'}
                </button>
              </div>
              {isSidebarExpanded && (
                <>
                  <div className={styles.buttonGroup}>
                    <button 
                      className={styles.generateButton}
                      onClick={() => setShowGenerateModal(true)}
                    >
                      Generate New Report
                    </button>
                    <button 
                      className={styles.addDatasourceButton}
                      onClick={() => setShowAddDatasourceModal(true)}
                    >
                      Add Datasource
                    </button>
                  </div>
                  <div className={styles.historyList}>
                    {reports.map((report) => (
                      <button
                        key={report.id}
                        className={`${styles.historyItem} ${productName === report.productName ? styles.active : ''}`}
                        onClick={() => handleViewReport(report)}
                      >
                        <div className={styles.historyItemHeader}>
                          <span className={styles.historyItemName}>{report.productName}</span>
                          <span className={styles.historyItemDate}>{formatDate(report.createdAt)}</span>
                        </div>
                        <p className={styles.historyItemDesc}>{report.intendedUse}</p>
                        <span className={styles.historyItemHazards}>{report.hazardCount} Hazards</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        <div className={styles.container}>
        {isGenerating ? (
          <div className={styles.generatingState}>
            <div className={styles.generatingSpinner}></div>
            <h1 className={styles.generatingTitle}>Generating Your Full Report...</h1>
            <p className={styles.generatingText}>This may take a few moments</p>
          </div>
        ) : (
          <>
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                <h1 className={styles.title}>First PHA Analysis Draft</h1>
                {productName && (
                  <div className={styles.productInfo}>
                    <p className={styles.productName}>
                      Product: <strong>{productName}</strong>
                    </p>
                    {intendedUse && (
                      <p className={styles.productDescription}>
                        {intendedUse}
                      </p>
                    )}
                  </div>
                )}
              </div>
              {isLoggedIn && (
                <button className={styles.downloadButton} onClick={handleDownload}>
                  <DownloadIcon />
                  Download Full Report
                </button>
              )}
            </div>

            <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>HAZARD</th>
                <th className={styles.th}>POTENTIAL HARM</th>
                <th className={styles.th}>SEVERITY</th>
                <th className={styles.th}>DETAIL</th>
              </tr>
            </thead>
            <tbody>
              {hazards.flatMap((hazard, hazardIndex) => 
                hazard.severity.map((sev, severityIndex) => {
                  let severityClass = styles.negligible
                  if (sev === 'Minor') severityClass = styles.minor
                  else if (sev === 'Moderate') severityClass = styles.moderate
                  else if (sev === 'Critical') severityClass = styles.critical
                  else if (sev === 'Major') severityClass = styles.moderate // Use moderate style for Major
                  
                  return (
                    <tr key={`${hazardIndex}-${severityIndex}`} className={styles.tr}>
                      {severityIndex === 0 && (
                        <td className={styles.td} rowSpan={hazard.severity.length}>
                          {hazard.hazard}
                        </td>
                      )}
                      <td className={styles.td}>{hazard.potentialHarm}</td>
                      <td className={styles.td}>
                        <span className={`${styles.severityBadge} ${severityClass}`}>
                          {sev}
                        </span>
                      </td>
                      <td className={styles.td}>
                        <button 
                          className={styles.infoButton} 
                          title="Detail"
                          onClick={() => handleInfoClick(hazard, sev)}
                        >
                          <InfoIcon />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {!isLoggedIn && (
          <div className={styles.footer}>
            <button className={styles.viewMoreButton} onClick={handleViewMore}>
              View More
            </button>
          </div>
        )}
          </>
        )}
      </div>
      </div>

      {showSignInModal && <SignInModal onClose={handleCloseModal} onSuccess={handleSignInSuccess} />}
      {showPaymentModal && <PaymentModal onClose={handleClosePayment} onSuccess={handlePaymentSuccess} />}
      <PHADetailsModal 
        isOpen={showPHADetailsModal}
        onClose={() => setShowPHADetailsModal(false)}
        hazard={selectedHazard}
      />

      <GenerateWorkflowModal
        isOpen={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onComplete={(productName, intendedUse, hazards) => {
          // Close modal
          setShowGenerateModal(false)
          
          // Add new report to history
          const newReport: Report = {
            id: Date.now().toString(),
            productName: productName,
            intendedUse: intendedUse || '',
            createdAt: new Date().toISOString().split('T')[0],
            hazardCount: hazards.length
          }
          setReports(prev => [newReport, ...prev])
          
          // Set user as logged in
          setIsLoggedIn(true)
          
          // Set the report data
          setProductName(productName)
          setIntendedUse(intendedUse || '')
          setCurrentHazards(hazards)
          
          // Show generating state
          setIsGenerating(true)
          
          // After generating state, show the full report
          setTimeout(() => {
            setIsGenerating(false)
          }, 3000)
        }}
      />

      <AddDatasourceModal
        isOpen={showAddDatasourceModal}
        onClose={() => setShowAddDatasourceModal(false)}
      />
    </main>
  )
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className={styles.main}>Loading...</div>}>
      <ResultsContent />
    </Suspense>
  )
}

