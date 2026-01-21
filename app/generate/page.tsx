'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import styles from './page.module.css'
import Header from '@/components/Header'
import ReportModal from '@/components/ReportModal'
import GenerateWorkflowContent from '@/components/GenerateWorkflowContent'
import { useGenerateWorkflow } from '@/lib/useGenerateWorkflow'
import { useAuth } from '@/lib/auth'
import { Hazard } from '@/lib/types'
import { trackEvent } from '@/lib/analytics'

function GenerateContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportData, setReportData] = useState<Hazard[]>([])

  const initialProductName = searchParams.get('productName') || ''
  
  const workflow = useGenerateWorkflow({
    initialProductName,
    skipPaymentCheck: true, // Generate page is always free - no payment required
    onPaymentRequired: () => {
      // This should not be called on Generate page
      console.warn('[Generate] onPaymentRequired called unexpectedly - Generate page should be free')
    },
    onComplete: async (productName, intendedUse, hazards, analysisId) => {
      console.log('[Generate] Analysis generation completed:', analysisId)
      setReportData(hazards)
      workflow.setCurrentStep('completed')
    }
  })

  // Generate Report button handler - always free, no payment required
  const handleGenerateReportWithPaymentCheck = async () => {
    console.log('[Generate] Generate Report clicked - starting analysis generation')
    await workflow.startAnalysisGeneration()
  }

  const handleViewReport = async () => {
    console.log('[Generate] handleViewReport called, analysisId:', workflow.analysisId)
    console.log('[Generate] reportData length:', reportData.length)
    
    trackEvent('view_report_modal', {
      analysis_id: workflow.analysisId || undefined,
      product_name: workflow.productName || undefined
    })
    
    // Fetch report data if not already loaded
    if (workflow.analysisId) {
      try {
        console.log('[Generate] Fetching report data from API...')
        const hazards = await workflow.fetchReportData()
        console.log('[Generate] Fetched hazards:', hazards.length)
        setReportData(hazards)
        setShowReportModal(true)
      } catch (error) {
        console.error('Error fetching report data:', error)
        alert(error instanceof Error ? error.message : 'Failed to load report data')
      }
    } else {
      console.log('[Generate] No analysisId, showing modal with existing reportData')
      setShowReportModal(true)
    }
  }

  const handleStartNewReport = () => {
    workflow.reset()
    setReportData([])
    setShowReportModal(false)
  }

  const renderCompleted = () => (
    <div className={styles.message}>
      <div className={styles.messageHeader}>
        <div className={styles.aiAvatar}>
          <img src="/favicon.ico" alt="CiraHealth AI" className={styles.aiAvatarImage} />
        </div>
      </div>
      <div className={styles.messageContent}>
        <div className={styles.completedButtons}>
          <button 
            className={styles.viewReportButton}
            onClick={handleViewReport}
          >
            View Report
          </button>
          <button 
            className={styles.newReportButton}
            onClick={handleStartNewReport}
          >
            Start New Report
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <main className={styles.main} style={{ flex: 1 }}>
      <Header showAuthButtons={true} showUserMenu={true} />

      <div className={styles.container}>
        <GenerateWorkflowContent
          messageHistory={workflow.messageHistory}
          currentStep={workflow.currentStep}
          productName={workflow.productName}
          setProductName={workflow.setProductName}
          intendedUse={workflow.intendedUse}
          setIntendedUse={workflow.setIntendedUse}
          selectedProducts={workflow.selectedProducts}
          similarProducts={workflow.similarProducts}
          workflowEndRef={workflow.workflowEndRef}
          handleDeviceNameSubmit={workflow.handleDeviceNameSubmit}
          handleIntendedUseAnswer={workflow.handleIntendedUseAnswer}
          handleIntendedUseSubmit={workflow.handleIntendedUseSubmit}
          handleRetrySearch={workflow.handleRetrySearch}
          handleNewSearch={workflow.handleNewSearch}
          handleToggleProduct={workflow.handleToggleProduct}
          handleGenerateReport={handleGenerateReportWithPaymentCheck}
          styles={styles}
          renderCompleted={renderCompleted}
          countdown={workflow.countdown}
        />
      </div>

      {showReportModal && (
        <ReportModal
          productName={workflow.productName}
          intendedUse={workflow.intendedUse}
          hazards={reportData}
          analysisId={workflow.analysisId}
          onClose={() => setShowReportModal(false)}
        />
      )}
    </main>
  )
}

export default function GeneratePage() {
  return (
    <Suspense fallback={<div className={styles.main}>Loading...</div>}>
      <GenerateContent />
    </Suspense>
  )
}
