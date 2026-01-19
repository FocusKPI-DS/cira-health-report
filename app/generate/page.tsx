'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import styles from './page.module.css'
import Header from '@/components/Header'
import ReportModal from '@/components/ReportModal'
import PaymentModal from '@/components/PaymentModal'
import GenerateWorkflowContent from '@/components/GenerateWorkflowContent'
import { useGenerateWorkflow } from '@/lib/useGenerateWorkflow'
import { getUserPaymentStatus } from '@/lib/payment-utils'
import { useAuth } from '@/lib/auth'
import { Hazard } from '@/lib/types'

// Google Analytics type declaration
declare global {
  interface Window {
    gtag?: (command: string, ...args: any[]) => void
  }
}

function GenerateContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const [showReportModal, setShowReportModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [reportData, setReportData] = useState<Hazard[]>([])
  const [isFirstTimeUser, setIsFirstTimeUser] = useState<boolean | null>(null)
  const [isCheckingUserStatus, setIsCheckingUserStatus] = useState(true)

  const initialProductName = searchParams.get('productName') || ''
  
  // Check user payment status on mount
  useEffect(() => {
    const checkUserStatus = async () => {
      if (authLoading || !user) {
        setIsCheckingUserStatus(false)
        return
      }

      try {
        const status = await getUserPaymentStatus(user.uid)
        setIsFirstTimeUser(status.isFirstTimeUser)
        console.log('[Generate] User status:', status)
      } catch (error) {
        console.error('[Generate] Error checking user status:', error)
        // Default to first-time user on error
        setIsFirstTimeUser(true)
      } finally {
        setIsCheckingUserStatus(false)
      }
    }

    checkUserStatus()
  }, [user, authLoading])
  
  const workflow = useGenerateWorkflow({
    initialProductName,
    skipPaymentCheck: isFirstTimeUser === true, // Skip payment check for first-time users
    onPaymentRequired: () => {
      // Show payment modal when payment is required
      setShowPaymentModal(true)
    },
    onComplete: (productName, intendedUse, hazards) => {
      setReportData(hazards)
      workflow.setCurrentStep('completed')
    }
  })

  const handleViewReport = async () => {
    console.log('[Generate] handleViewReport called, analysisId:', workflow.analysisId)
    console.log('[Generate] reportData length:', reportData.length)
    
    // Track view report modal event in GA4
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'view_report_modal', {
        analysis_id: workflow.analysisId || undefined,
        product_name: workflow.productName || undefined
      })
    }
    
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

  const handlePaymentClose = () => {
    setShowPaymentModal(false)
  }

  const handlePaymentSuccess = async () => {
    setShowPaymentModal(false)
    // After successful payment, start the analysis generation
    await workflow.startAnalysisGeneration()
  }

  const renderCompleted = () => (
    <div className={styles.message}>
      <div className={styles.messageHeader}>
        <div className={styles.aiAvatar}>CA</div>
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
    <main className={styles.main}>
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
          handleGenerateReport={workflow.handleGenerateReport}
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

      {showPaymentModal && (
        <PaymentModal
          onClose={handlePaymentClose}
          onSuccess={handlePaymentSuccess}
          productName={workflow.productName}
          amount={5.00}
          purpose="generation"
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
