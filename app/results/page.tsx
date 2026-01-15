'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import styles from './page.module.css'
import Header from '@/components/Header'
import SignInModal from '@/components/SignInModal'
import PaymentModal from '@/components/PaymentModal'
import PHADetailsModal from '@/components/PHADetailsModal'
import GenerateWorkflowModal from '@/components/GenerateWorkflowModal'
import AddDatasourceModal from '@/components/AddDatasourceModal'
import { InfoIcon, DownloadIcon } from '@/components/Icons'
import { useAuth } from '@/lib/auth'
import { analysisApi } from '@/lib/analysis-api'

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
  const { user, loading: authLoading, isAnonymous } = useAuth()
  const [productName, setProductName] = useState('')
  const [intendedUse, setIntendedUse] = useState('')
  const [showSignInModal, setShowSignInModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showPHADetailsModal, setShowPHADetailsModal] = useState(false)
  const [selectedHazard, setSelectedHazard] = useState<PHADetails | null>(null)
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [showAddDatasourceModal, setShowAddDatasourceModal] = useState(false)
  const [currentHazards, setCurrentHazards] = useState<Hazard[]>([])
  const [report_list, setReport_list] = useState<Report[]>([])
  const [isLoadingReports, setIsLoadingReports] = useState(false)
  const [isLoadingHazards, setIsLoadingHazards] = useState(false)
  const [analysisId, setAnalysisId] = useState<string | null>(null)

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
    const generatingParam = searchParams.get('generating')
    const analysisIdParam = searchParams.get('analysis_id')
    
    if (product) {
      setProductName(product)
    }
    if (use) {
      setIntendedUse(use)
    }
    if (analysisIdParam) {
      setAnalysisId(analysisIdParam)
    }
    
    // If generating flag is present, show generating state
    if (generatingParam === 'true') {
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

  // Fetch hazard data when analysisId is available
  useEffect(() => {
    const fetchHazardData = async () => {
      if (!analysisId) return
      
      setIsLoadingHazards(true)
      try {
        console.log('[Results] Fetching hazard data for analysis_id:', analysisId)
        const hazards = await analysisApi.fetchTransformedResults(analysisId, 1, 100)
        console.log('[Results] Fetched hazards:', hazards)
        setCurrentHazards(hazards)
      } catch (error) {
        console.error('[Results] Error fetching hazard data:', error)
        setCurrentHazards([])
      } finally {
        setIsLoadingHazards(false)
      }
    }
    
    fetchHazardData()
  }, [analysisId])

  // Fetch report list from API when user is available
  useEffect(() => {
    const fetchReportListData = async () => {
      if (!user || authLoading) return
      
      setIsLoadingReports(true)
      try {
        console.log('[Results] Fetching report list...')
        const analyses = await analysisApi.fetchReportList()
        console.log('[Results] Received analyses:', analyses)
        
        const formattedReports: Report[] = analyses.map((analysis: any) => ({
          id: analysis.analysis_id,
          productName: analysis.device_name || 'Unknown Device',
          intendedUse: analysis.intended_use || '',
          createdAt: analysis.completed_at ? new Date(analysis.completed_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          hazardCount: analysis.hazard_count || 0
        }))
        console.log('[Results] Formatted reports:', formattedReports)
        setReport_list(formattedReports)
      } catch (error) {
        console.error('[Results] Error fetching report list:', error)
        // Set empty list on error
        setReport_list([])
      } finally {
        setIsLoadingReports(false)
      }
    }
    
    fetchReportListData()
  }, [user, authLoading])

  const handleViewReport = (report: Report) => {
    router.push(`/results?analysis_id=${encodeURIComponent(report.id)}&productName=${encodeURIComponent(report.productName)}&intendedUse=${encodeURIComponent(report.intendedUse)}`)
  }

  // Show hazards from currentHazards if available (from API), otherwise show empty
  const hazards = currentHazards.length > 0 ? currentHazards : []

  const handleViewMore = () => {
    setShowSignInModal(true)
  }

  const handleCloseModal = () => {
    setShowSignInModal(false)
  }

  const handleSignInSuccess = () => {
    setShowSignInModal(false)
    // User state will be updated by AuthProvider
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
      <Header showAuthButtons={!user || isAnonymous} showUserMenu={!!(user && !isAnonymous)} />
      <div className={styles.pageContent}>
        <div className={`${styles.sidebarWrapper} ${!isSidebarExpanded ? styles.sidebarWrapperCollapsed : ''}`}>
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
                {/* Report history list */}
                <div className={styles.historyList}>
                  {isLoadingReports ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                      Loading reports...
                    </div>
                  ) : report_list.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                      No reports yet. Generate your first report!
                    </div>
                  ) : (
                    report_list.map((report) => (
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
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
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
              {user && !isAnonymous && (
                <button className={styles.downloadButton} onClick={handleDownload}>
                  <DownloadIcon />
                  Download Full Report
                </button>
              )}
            </div>

            {isLoadingHazards ? (
              <div className={styles.generatingState}>
                <div className={styles.generatingSpinner}></div>
                <p className={styles.generatingText}>Loading report data...</p>
              </div>
            ) : hazards.length === 0 ? (
              <div className={styles.generatingState}>
                <p className={styles.generatingText}>No hazard data available</p>
              </div>
            ) : (
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
            )}

        {(!user || isAnonymous) && hazards.length > 0 && (
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
          setReport_list(prev => [newReport, ...prev])
          
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

