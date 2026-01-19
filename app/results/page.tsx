'use client'

import { useState, useEffect, useRef, Suspense, JSX } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import styles from './page.module.css'
import Header from '@/components/Header'
import SignInModal from '@/components/SignInModal'
import PHADetailsModal from '@/components/PHADetailsModal'
import GenerateWorkflowModal from '@/components/GenerateWorkflowModal'
import AddDatasourceModal from '@/components/AddDatasourceModal'
import PaymentModal from '@/components/PaymentModal'
import { InfoIcon, DownloadIcon } from '@/components/Icons'
import { useAuth } from '@/lib/auth'
import { analysisApi } from '@/lib/analysis-api'

// Google Analytics type declaration
declare global {
  interface Window {
    gtag?: (command: string, ...args: any[]) => void
  }
}

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
  const [showPaymentModal, setShowPaymentModal] = useState(false)
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
  const [shouldRestart, setShouldRestart] = useState<boolean>(false)
  const [hasTriggeredRestart, setHasTriggeredRestart] = useState<boolean>(false)
  const [progressData, setProgressData] = useState<{
    totalDetailRecords: number
    planTotalRecords: number
    progressPercentage: number
    aiCurrentCount: number
    aiTotalRecords: number
    aiProgressPercentage: number
  } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [totalPages, setTotalPages] = useState(1)
  const [totalHazards, setTotalHazards] = useState(0)
  const [totalRecords, setTotalRecords] = useState(0)
  const [severityLevel, setSeverityLevel] = useState('all')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  // Stop any existing polling
  const stopPolling = () => {
    if (pollingTimerRef.current) {
      console.log('[Results] Stopping existing polling')
      clearTimeout(pollingTimerRef.current)
      pollingTimerRef.current = null
    }
  }

  // Start polling for analysis status
  const startPolling = (analysisIdToMonitor: string) => {
    stopPolling() // Clear any existing polling first
    
    console.log('[Results] Starting polling for analysis:', analysisIdToMonitor)
    
    const pollStatus = async () => {
      try {
        const response = await analysisApi.getAnalysisResults(analysisIdToMonitor, currentPage, pageSize, severityLevel, searchKeyword)
        console.log('[Results] Polling status:', response.status)
        
        // Update table data and pagination info from polling response
        setCurrentHazards(response.results || [])
        setTotalPages(response.total_pages || 1)
        setTotalHazards(response.total || 0)
        setTotalRecords(response.total_records || 0)
        
        if (response.status !== 'Generating') {
          console.log('[Results] Analysis completed, stopping polling')
          setIsGenerating(false)
          setProgressData(null)
          stopPolling()
          // Reload to show new results
          window.location.reload()
        } else {
          // Update progress data
          setProgressData({
            totalDetailRecords: response.total_detail_records || 0,
            planTotalRecords: response.plan_total_records || 0,
            progressPercentage: response.progress_percentage || 0,
            aiCurrentCount: response.ai_current_count || 0,
            aiTotalRecords: response.ai_total_records || 0,
            aiProgressPercentage: response.ai_progress_percentage || 0
          })
          // Continue polling
          pollingTimerRef.current = setTimeout(pollStatus, 7000)
        }
      } catch (error) {
        console.error('[Results] Error polling status:', error)
        setIsGenerating(false)
        stopPolling()
      }
    }
    
    // Start first poll after 2 seconds
    pollingTimerRef.current = setTimeout(pollStatus, 2000)
  }

  // Debounce search input to avoid API calls on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchKeyword(searchInput)
      setCurrentPage(1)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    const product = searchParams.get('productName') || ''
    const use = searchParams.get('intendedUse') || ''
    const generatingParam = searchParams.get('generating')
    const analysisIdParam = searchParams.get('analysis_id')
    const restartParam = searchParams.get('restart')
    
    if (product) {
      setProductName(product)
    }
    if (use) {
      setIntendedUse(use)
    }
    if (analysisIdParam) {
      setAnalysisId(analysisIdParam)
    }
    if (restartParam === '1') {
      setShouldRestart(true)
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
      
      // Stop any existing polling when switching to a different analysis
      stopPolling()
      
      setIsLoadingHazards(true)
      try {
        console.log('[Results] Fetching hazard data for analysis_id:', analysisId, 'page:', currentPage, 'pageSize:', pageSize, 'severity:', severityLevel, 'search:', searchKeyword)
        const response = await analysisApi.getAnalysisResults(analysisId, currentPage, pageSize, severityLevel, searchKeyword)
        //console.log('[Results] Fetched results:', response)
        //console.log('[Results] Results array:', response.results)
        if (response.results && response.results.length > 0) {
          console.log('[Results] First hazard structure:', JSON.stringify(response.results[0], null, 2))
        }
        setCurrentHazards(response.results || [])
        setTotalPages(response.total_pages || 1)
        setTotalHazards(response.total || 0)
        setTotalRecords(response.total_records || 0)
        // Update progress data if status is Generating
        if (response.status === 'Generating') {
          console.log('[Results] Analysis is generating, setting up progress tracking')
          setProgressData({
            totalDetailRecords: response.total_detail_records || 0,
            planTotalRecords: response.plan_total_records || 0,
            progressPercentage: response.progress_percentage || 0,
            aiCurrentCount: response.ai_current_count || 0,
            aiTotalRecords: response.ai_total_records || 0,
            aiProgressPercentage: response.ai_progress_percentage || 0
          })
          // Start polling if not already polling
          if (!pollingTimerRef.current) {
            startPolling(analysisId)
          }
        } else {
          console.log('[Results] Analysis completed or not generating')
          setProgressData(null)
          stopPolling()
        }
        
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
    
    // Cleanup: stop polling when component unmounts or dependencies change
    return () => {
      stopPolling()
    }
  }, [analysisId, currentPage, pageSize, severityLevel, searchKeyword])

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

  // Auto-trigger restart if restart=1 parameter is present
  useEffect(() => {
    if (shouldRestart && analysisId && !isLoadingHazards && !isGenerating && !hasTriggeredRestart) {
      console.log('[Results] Auto-triggering restart for analysis:', analysisId)
      setHasTriggeredRestart(true)
      setShouldRestart(false)
      
      // Remove restart parameter from URL
      const params = new URLSearchParams(searchParams.toString())
      params.delete('restart')
      router.replace(`/results?${params.toString()}`)
      
      // Trigger the restart by calling the function inline
      ;(async () => {
        if (!analysisId) {
          alert('No analysis ID available')
          return
        }

        try {
          console.log('[Results] Restarting full analysis for:', analysisId)
          const response = await analysisApi.restartFullAnalysis(analysisId)
          console.log('[Results] Restart response:', response)
          
          // Immediately fetch updated filter settings to get the new automatic_settings_enabled status
          try {
            const filters = await analysisApi.getAnalysisFilters(analysisId)
            console.log('[Results] Updated filters after restart:', filters)
            setAutomaticSettingsEnabled(filters.automatic_settings_enabled || false)
          } catch (filterError) {
            console.error('[Results] Error fetching updated filters:', filterError)
          }
          
          // Show generating state
          setIsGenerating(true)
          
          // Navigate to the results page with generating flag
          router.push(`/results?analysis_id=${analysisId}&productName=${encodeURIComponent(productName)}&intendedUse=${encodeURIComponent(intendedUse)}&generating=true`)
          
          // Start polling for completion using unified polling function
          startPolling(analysisId)
        } catch (error) {
          console.error('[Results] Error restarting analysis:', error)
          alert('Failed to restart analysis. Please try again.')
        }
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRestart, analysisId, isLoadingHazards, isGenerating, hasTriggeredRestart])

  // Auto-select first report if no analysis_id is present
  useEffect(() => {
    // Only proceed if reports are loaded and not currently loading
    if (isLoadingReports || report_list.length === 0) return
    
    // Check if there's no analysis_id in URL
    if (!analysisId && report_list.length > 0) {
      const firstReport = report_list[0]
      console.log('[Results] No analysis_id found, auto-selecting first report:', firstReport)
      
      // Navigate to the first report
      router.push(`/results?analysis_id=${encodeURIComponent(firstReport.id)}&productName=${encodeURIComponent(firstReport.productName)}&intendedUse=${encodeURIComponent(firstReport.intendedUse)}`)
    }
  }, [report_list, isLoadingReports, analysisId, router])

  const handleViewReport = (report: Report) => {
    // Track view report modal event in GA4
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'view_report_modal', {
        analysis_id: report.id,
        product_name: report.productName
      })
    }
    
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

  const handleClosePayment = () => {
    setShowPaymentModal(false)
  }

  const handlePaymentSuccess = async (paymentIntentId?: string) => {
    setShowPaymentModal(false)
    // After payment, check and download
    // Note: For download payments, we don't need to update metadata since analysis already exists
    await checkPaymentAndDownload()
  }

  const checkPaymentAndDownload = async () => {
    console.log('[Results] ===== CHECKING PAYMENT FOR DOWNLOAD =====')
    console.log('[Results] Analysis ID:', analysisId)
    console.log('[Results] User ID:', user?.uid)
    
    if (!analysisId) {
      console.log('[Results] ❌ CONDITION FAILED: No analysis ID available')
      alert('No analysis ID available')
      return false
    }

    try {
      console.log('[Results] Step 1: Querying payments by analysisId...')
      console.log('[Results] API URL: /api/payments/transactions?analysisId=' + encodeURIComponent(analysisId))
      
      // First, check if this specific analysis has been paid for
      const analysisResponse = await fetch(`/api/payments/transactions?analysisId=${encodeURIComponent(analysisId)}`)
      
      console.log('[Results] Response status:', analysisResponse.status, analysisResponse.statusText)
      
      if (!analysisResponse.ok) {
        console.log('[Results] ❌ API REQUEST FAILED')
        throw new Error('Failed to check payment status')
      }

      const analysisData = await analysisResponse.json()
      console.log('[Results] Raw API response:', analysisData)
      console.log('[Results] Total transactions in response:', analysisData.transactions?.length || 0)
      
      const analysisPayments = analysisData.transactions?.filter((t: any) => t.status === 'succeeded') || []
      console.log('[Results] Successful payments found:', analysisPayments.length)
      
      if (analysisPayments.length > 0) {
        console.log('[Results] ✅ CONDITION MET: Payment found for this analysis')
        console.log('[Results] Payment details:', analysisPayments[0])
        console.log('[Results] Payment analysisId in metadata:', analysisPayments[0].analysisId)
        console.log('[Results] Proceeding with download...')
        await performDownload()
        return true
      }

      console.log('[Results] ❌ CONDITION NOT MET: No payment found with analysisId =', analysisId)
      console.log('[Results] All transactions returned:', analysisData.transactions)
      console.log('[Results] Checking what analysisIds are in the transactions:')
      analysisData.transactions?.forEach((t: any, index: number) => {
        console.log(`[Results]   Transaction ${index + 1}: analysisId = "${t.analysisId}", status = "${t.status}"`)
      })

      // If no payment for this analysis, require payment for download
      // This is a safety check - they should have paid before generation, but if they bypassed that,
      // they need to pay now to download
      console.log('[Results] ===== FINAL DECISION: PAYMENT REQUIRED =====')
      console.log('[Results] Reason: No successful payment found with metadata.analysis_id matching:', analysisId)
      return false
    } catch (error) {
      console.error('[Results] ===== ERROR IN PAYMENT CHECK =====')
      console.error('[Results] Error:', error)
      return false
    }
  }

  const performDownload = async () => {
    if (!analysisId) {
      return
    }

    try {
      console.log('[Results] Exporting analysis:', analysisId)
      const blob = await analysisApi.exportAnalysis(analysisId, 'excel')
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `pha_analysis_${analysisId}_details.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      console.log('[Results] Export completed')
    } catch (error) {
      console.error('[Results] Error exporting analysis:', error)
      alert('Failed to export report. Please try again.')
    }
  }

  const handleDownload = async () => {
    if (!analysisId) {
      alert('No analysis ID available')
      return
    }

    try {
      // Check analysis status before downloading
      console.log('[Results] Checking analysis status before download:', analysisId)
      const statusResponse = await analysisApi.getAnalysisResults(analysisId, 1, 1)
      
      if (statusResponse.status === 'Generating') {
        alert('Please wait for the analysis to complete')
        return
      }
      
      // Check if payment has been made for this analysis
      const hasPaid = await checkPaymentAndDownload()
      
      if (!hasPaid) {
        // No payment found, show payment modal
        console.log('[Results] Payment required, showing payment modal')
        setShowPaymentModal(true)
      }
    } catch (error) {
      console.error('[Results] Error in download flow:', error)
      alert('Failed to process download. Please try again.')
    }
  }

  const handleGenerateWholeReport = () => {
    // Track generate whole report event in GA4
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'generate_whole_report', {
        analysis_id: analysisId || undefined,
        product_name: productName || undefined
      })
    }
    
    handleRestartFullAnalysis()
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
      
      // Immediately fetch updated filter settings to get the new automatic_settings_enabled status
      try {
        const filters = await analysisApi.getAnalysisFilters(analysisId)
        console.log('[Results] Updated filters after restart:', filters)
        setAutomaticSettingsEnabled(filters.automatic_settings_enabled || false)
      } catch (filterError) {
        console.error('[Results] Error fetching updated filters:', filterError)
      }
      
      // Show generating state
      setIsGenerating(true)
      
      // Navigate to the results page with generating flag
      router.push(`/results?analysis_id=${analysisId}&productName=${encodeURIComponent(productName)}&intendedUse=${encodeURIComponent(intendedUse)}&generating=true`)
      
      // Start polling for completion using unified polling function
      startPolling(analysisId)
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
      <div className={`${styles.pageContent} ${!isSidebarExpanded ? styles.pageContentCollapsed : ''}`}>
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
                    onClick={() => {
                      // Track click add datasource event in GA4
                      if (typeof window !== 'undefined' && window.gtag) {
                        window.gtag('event', 'click_add_datasource', {
                          page: 'results',
                          analysis_id: analysisId || undefined
                        })
                      }
                      setShowAddDatasourceModal(true)
                    }}
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
              <h1 className={styles.title}>First PHA Analysis Draft</h1>
              {user && automaticSettingsEnabled && (
                <button className={styles.downloadButton} onClick={handleGenerateWholeReport}>
                  <DownloadIcon />
                  Generate Whole Report
                </button>
              )}
              {user && !automaticSettingsEnabled && (
                <button className={styles.downloadButton} onClick={handleDownload}>
                  <DownloadIcon />
                  Download Full Report
                </button>
              )}
            </div>
            
            {progressData && (
              <div style={{ marginTop: '8px', padding: '16px', backgroundColor: '#f5f5f5', borderRadius: '8px', display: 'flex', gap: '24px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '500' }}>Detail Records Progress</span>
                    <span style={{ fontSize: '14px', fontWeight: '600' }}>{progressData.progressPercentage.toFixed(1)}%</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                    {progressData.totalDetailRecords} / around {progressData.planTotalRecords} records
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: '#e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(progressData.progressPercentage, 100)}%`, height: '100%', backgroundColor: '#4CAF50', transition: 'width 0.3s ease' }}></div>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '500' }}>AI Processing Progress</span>
                    <span style={{ fontSize: '14px', fontWeight: '600' }}>{progressData.aiProgressPercentage.toFixed(1)}%</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                    {progressData.aiCurrentCount} / Max {progressData.aiTotalRecords} records
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: '#e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(progressData.aiProgressPercentage, 100)}%`, height: '100%', backgroundColor: '#2196F3', transition: 'width 0.3s ease' }}></div>
                  </div>
                </div>
              </div>
            )}
            
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

            {/* Filter and Search Controls - Always visible */}
            {!isLoadingHazards && (
              <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid rgba(14, 165, 233, 0.2)' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Search Input */}
                  <div style={{ flex: '1 1 300px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>
                      Search
                    </label>
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => {
                        setSearchInput(e.target.value)
                      }}
                      placeholder="Search hazards, harms..."
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid rgba(14, 165, 233, 0.2)',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                  
                  {/* Severity Filter */}
                  <div style={{ flex: '0 0 200px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>
                      Severity Level
                    </label>
                    <select
                      value={severityLevel}
                      onChange={(e) => {
                        setSeverityLevel(e.target.value)
                        setCurrentPage(1) // Reset to first page on filter change
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid rgba(14, 165, 233, 0.2)',
                        borderRadius: '6px',
                        fontSize: '14px',
                        backgroundColor: 'white'
                      }}
                    >
                      <option value="all">All Severities</option>
                      <option value="Negligible">Negligible</option>
                      <option value="Minor">Minor</option>
                      <option value="Serious">Serious</option>
                      <option value="Major">Major</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                </div>
                
                {/* Results Info */}
                <div style={{ marginTop: '8px', fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>
                  
                
                  <span style={{ marginTop: '12px', marginRight: '20px', fontSize: '14px', color: '#64748b' }}>
                  Showing {hazards.length > 0 ? ((currentPage - 1) * pageSize + 1) : 0} - {Math.min(currentPage * pageSize, totalHazards)} of {totalHazards} Hazards
                  </span>
                  Total Details: {totalRecords}
                </div>
              </div>
            )}

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
              <>

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
                    else if (severityItem.severity === 'Negligible') severityClass = styles.negligible
                    else if (severityItem.severity === 'Serious') severityClass = styles.serious
                    else if (severityItem.severity === 'Critical') severityClass = styles.critical
                    else if (severityItem.severity === 'Major') severityClass = styles.major
                    
                    rows.push(
                      <tr key={`${hazardIndex}-${harmIndex}-${severityIndex}`} className={styles.tr}>
                        {isFirstHazardRow && (
                          <td className={`${styles.td} ${styles.tdHazard}`} 
                            rowSpan={hazard.hazard_rowspan}>
                            {hazard.hazard}
                          </td>
                        )}
                        {isFirstHarmRow && (
                          <td className={styles.td} rowSpan={harmItem.harm_rowspan}>
                            {harmItem.potential_harm}
                          </td>
                        )}
                        <td className={`${styles.td}`}>
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
        
        {/* Pagination Controls */}
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid rgba(14, 165, 233, 0.2)', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '8px 16px',
              backgroundColor: currentPage === 1 ? '#e2e8f0' : 'linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)',
              background: currentPage === 1 ? '#e2e8f0' : 'linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)',
              color: currentPage === 1 ? '#94a3b8' : 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            ← Previous
          </button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>
              Page {currentPage} of {totalPages}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b', whiteSpace: 'nowrap' }}>
                Items per page:
              </label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
                style={{
                  padding: '6px 10px',
                  border: '1px solid rgba(14, 165, 233, 0.2)',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </div>
          </div>
          
          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage >= totalPages}
            style={{
              padding: '8px 16px',
              backgroundColor: currentPage >= totalPages ? '#e2e8f0' : 'linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)',
              background: currentPage >= totalPages ? '#e2e8f0' : 'linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)',
              color: currentPage >= totalPages ? '#94a3b8' : 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            Next →
          </button>
        </div>
              </>
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
      {showPaymentModal && (
        <PaymentModal 
          onClose={handleClosePayment} 
          onSuccess={handlePaymentSuccess}
          reportId={analysisId || undefined}
          analysisId={analysisId || undefined}
          productName={productName || undefined}
          amount={5.00}
        />
      )}
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

