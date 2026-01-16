'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import styles from './page.module.css'
import Header from '@/components/Header'
import SignInModal from '@/components/SignInModal'
import PHADetailsModal from '@/components/PHADetailsModal'
import GenerateWorkflowModal from '@/components/GenerateWorkflowModal'
import AddDatasourceModal from '@/components/AddDatasourceModal'
import { InfoIcon, DownloadIcon } from '@/components/Icons'
import { useAuth } from '@/lib/auth'
import { analysisApi } from '@/lib/analysis-api'

interface SeverityItem {
  severity: string
  severity_rowspan: number
  count: number
  last_edit_by: string
  last_edit_by_name: string | null
  last_edit_at: string
}

interface PotentialHarmItem {
  potential_harm: string
  harm_rowspan: number
  potential_harm_list: SeverityItem[]
}

interface Hazard {
  hazard: string
  hazard_count: number
  hazard_rowspan: number
  hazard_list: PotentialHarmItem[]
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
  const [showPHADetailsModal, setShowPHADetailsModal] = useState(false)
  const [selectedHazard, setSelectedHazard] = useState<string>('')
  const [selectedPotentialHarm, setSelectedPotentialHarm] = useState<string>('')
  const [selectedSeverity, setSelectedSeverity] = useState<string>('')
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [showAddDatasourceModal, setShowAddDatasourceModal] = useState(false)
  const [currentHazards, setCurrentHazards] = useState<Hazard[]>([])
  const [report_list, setReport_list] = useState<Report[]>([])
  const [isLoadingReports, setIsLoadingReports] = useState(false)
  const [isLoadingHazards, setIsLoadingHazards] = useState(false)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [automaticSettingsEnabled, setAutomaticSettingsEnabled] = useState<boolean>(false)

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
        const response = await analysisApi.getAnalysisResults(analysisId, 1, 100)
        //console.log('[Results] Fetched results:', response)
        //console.log('[Results] Results array:', response.results)
        if (response.results && response.results.length > 0) {
          console.log('[Results] First hazard structure:', JSON.stringify(response.results[0], null, 2))
        }
        setCurrentHazards(response.results || [])
        
        // Fetch filter settings to check automatic_settings_enabled
        try {
          const filters = await analysisApi.getAnalysisFilters(analysisId)
          console.log('[Results] Fetched filters:', filters)
          setAutomaticSettingsEnabled(filters.automatic_settings_enabled || false)
        } catch (filterError) {
          console.error('[Results] Error fetching filters:', filterError)
          setAutomaticSettingsEnabled(false)
        }
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
    // If user is anonymous, show sign-in modal
    if (!user || isAnonymous) {
      setShowSignInModal(true)
      return
    }

    // Real user handling
    if (automaticSettingsEnabled) {
      // If automatic settings is enabled, trigger restart full analysis
      handleRestartFullAnalysis()
    } else {
      // If automatic settings is disabled, show download (currently just alert)
      alert('Download functionality will be implemented here. This would download the full report.')
    }
  }

  const handleRestartFullAnalysis = async () => {
    if (!analysisId) {
      alert('No analysis ID available')
      return
    }

    try {
      console.log('[Results] Restarting full analysis for:', analysisId)
      const response = await analysisApi.restartFullAnalysis(analysisId)
      console.log('[Results] Restart response:', response)
      
      // Show generating state
      setIsGenerating(true)
      
      // Navigate to the results page with generating flag
      router.push(`/results?analysis_id=${analysisId}&productName=${encodeURIComponent(productName)}&intendedUse=${encodeURIComponent(intendedUse)}&generating=true`)
      
      // Poll for completion
      const pollStatus = async () => {
        try {
          const status = await analysisApi.checkAnalysisStatus(analysisId)
          if (status.status !== 'Generating') {
            setIsGenerating(false)
            // Reload the page to show new results
            window.location.reload()
          } else {
            setTimeout(pollStatus, 5000)
          }
        } catch (error) {
          console.error('[Results] Error polling status:', error)
          setIsGenerating(false)
        }
      }
      
      setTimeout(pollStatus, 5000)
    } catch (error) {
      console.error('[Results] Error restarting analysis:', error)
      alert('Failed to restart analysis. Please try again.')
    }
  }

  const handleInfoClick = (hazardName: string, potentialHarm: string, severity: string) => {
    setSelectedHazard(hazardName)
    setSelectedPotentialHarm(potentialHarm)
    setSelectedSeverity(severity)
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
                        className={`${styles.historyItem} ${analysisId === report.id ? styles.active : ''}`}
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
              {/* TODO: For testing purposes - commented out isAnonymous check. Restore after fixing auth state detection */}
              {user && (
                <button className={styles.downloadButton} onClick={handleDownload}>
                  <DownloadIcon />
                  {automaticSettingsEnabled ? 'Generate Whole Report' : 'Download Full Report'}
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
              {hazards.map((hazard, hazardIndex) => {
                let isFirstHazardRow = true
                const rows: JSX.Element[] = []
                
                hazard.hazard_list?.forEach((harmItem, harmIndex) => {
                  let isFirstHarmRow = true
                  
                  harmItem.potential_harm_list?.forEach((severityItem, severityIndex) => {
                    let severityClass = styles.negligible
                    if (severityItem.severity === 'Minor') severityClass = styles.minor
                    else if (severityItem.severity === 'Moderate') severityClass = styles.moderate
                    else if (severityItem.severity === 'Critical') severityClass = styles.critical
                    else if (severityItem.severity === 'Major') severityClass = styles.moderate
                    
                    rows.push(
                      <tr key={`${hazardIndex}-${harmIndex}-${severityIndex}`} className={styles.tr}>
                        {isFirstHazardRow && (
                          <td className={styles.td} rowSpan={hazard.hazard_rowspan}>
                            {hazard.hazard}
                          </td>
                        )}
                        {isFirstHarmRow && (
                          <td className={styles.td} rowSpan={harmItem.harm_rowspan}>
                            {harmItem.potential_harm}
                          </td>
                        )}
                        <td className={styles.td}>
                          <span className={`${styles.severityBadge} ${severityClass}`}>
                            {severityItem.severity}
                          </span>
                        </td>
                        <td className={styles.td}>
                          <button 
                            className={styles.infoButton} 
                            title="Detail"
                            onClick={() => handleInfoClick(hazard.hazard, harmItem.potential_harm, severityItem.severity)}
                          >
                            <InfoIcon />
                          </button>
                        </td>
                      </tr>
                    )
                    
                    isFirstHazardRow = false
                    isFirstHarmRow = false
                  })
                })
                
                return rows
              })}
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
      {/* showPaymentModal && (
        <PaymentModal 
          onClose={handleClosePayment} 
          onSuccess={handlePaymentSuccess}
          reportId={analysisId || undefined}
          productName={productName || undefined}
          amount={5.00}
        />
      )*/}
      <PHADetailsModal 
        isOpen={showPHADetailsModal}
        onClose={() => setShowPHADetailsModal(false)}
        analysisId={analysisId}
        hazard={selectedHazard}
        potentialHarm={selectedPotentialHarm}
        severity={selectedSeverity}
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

