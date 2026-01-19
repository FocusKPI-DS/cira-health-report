'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
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
  const paymentIntentIdRef = useRef<string | null>(null) // Use ref to persist paymentIntentId across renders

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
    onComplete: async (productName, intendedUse, hazards, analysisId) => {
      setReportData(hazards)
      workflow.setCurrentStep('completed')
      
      // Log when onComplete is called
      console.log('[Generate] ===== onComplete CALLED =====')
      console.log('[Generate] onComplete received analysisId:', analysisId)
      console.log('[Generate] Current paymentIntentId in ref:', paymentIntentIdRef.current)
      
      // Update payment intent metadata with actual analysis_id if payment was made before generation
      if (analysisId && paymentIntentIdRef.current) {
        await updatePaymentMetadata(analysisId, paymentIntentIdRef.current)
      } else if (paymentIntentIdRef.current) {
        console.warn('[Generate] onComplete: paymentIntentId exists but analysisId is missing. Cannot update metadata.')
      } else {
        console.log('[Generate] onComplete: No paymentIntentId, skipping metadata update.')
      }
    }
  })

  // Override handleGenerateReport to check payment status
  const handleGenerateReportWithPaymentCheck = async () => {
    console.log('[Generate] ===== handleGenerateReportWithPaymentCheck CALLED =====')
    console.log('[Generate] Current state:', { 
      user: user?.uid, 
      isFirstTimeUser, 
      isCheckingUserStatus 
    })
    
    // If user is not authenticated, proceed as first-time user
    if (!user) {
      console.log('[Generate] No user, proceeding as first-time user')
      await workflow.startAnalysisGeneration()
      return
    }

    // If user status hasn't been checked yet, check it now
    if (isFirstTimeUser === null && !isCheckingUserStatus) {
      console.log('[Generate] User status not checked yet, checking now...')
      setIsCheckingUserStatus(true)
      try {
        const status = await getUserPaymentStatus(user.uid)
        setIsFirstTimeUser(status.isFirstTimeUser)
        console.log('[Generate] User status checked:', status)
        
        // After checking, proceed with the logic
        if (status.isFirstTimeUser) {
          console.log('[Generate] First-time user, generating without payment')
          await workflow.startAnalysisGeneration()
        } else {
          console.log('[Generate] Returning user, showing payment modal')
          setShowPaymentModal(true)
        }
      } catch (error) {
        console.error('[Generate] Error checking user status:', error)
        // On error, proceed as first-time user
        setIsFirstTimeUser(true)
        await workflow.startAnalysisGeneration()
      } finally {
        setIsCheckingUserStatus(false)
      }
      return
    }

    // If still checking, wait a bit and retry (or proceed as first-time for better UX)
    if (isCheckingUserStatus) {
      console.log('[Generate] User status check in progress, proceeding as first-time user')
      await workflow.startAnalysisGeneration()
      return
    }

    // If first-time user, skip payment and generate directly
    if (isFirstTimeUser === true) {
      console.log('[Generate] First-time user, generating without payment')
      await workflow.startAnalysisGeneration()
      return
    }

    // Returning user - show payment modal
    console.log('[Generate] Returning user, showing payment modal')
    setShowPaymentModal(true)
  }

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
    paymentIntentIdRef.current = null // Clear paymentIntentId when starting new report
  }

  const handlePaymentClose = () => {
    setShowPaymentModal(false)
  }

  const handlePaymentSuccess = async (paymentIntentId?: string) => {
    setShowPaymentModal(false)
    // Store paymentIntentId in ref to update metadata after analysis is generated
    if (paymentIntentId) {
      paymentIntentIdRef.current = paymentIntentId
      console.log('[Generate] Payment successful, stored paymentIntentId in ref:', paymentIntentId)
    }
    // After successful payment, start the analysis generation
    await workflow.startAnalysisGeneration()
  }

  // Update payment intent metadata with analysis_id after generation completes
  const updatePaymentMetadata = async (analysisId: string, currentPaymentIntentId: string) => {
    if (!currentPaymentIntentId) {
      console.log('[Generate] No paymentIntentId to update - payment may not have been made before generation')
      return
    }

    console.log('[Generate] ===== ATTEMPTING TO UPDATE PAYMENT METADATA =====')
    console.log('[Generate] paymentIntentId:', currentPaymentIntentId)
    console.log('[Generate] analysisId:', analysisId)

    try {
      const response = await fetch('/api/payments/update-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentIntentId: currentPaymentIntentId,
          analysisId: analysisId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('[Generate] ===== FAILED TO UPDATE PAYMENT INTENT =====')
        console.error('[Generate] Error response:', error)
        console.error('[Generate] Status:', response.status)
        return
      }

      const data = await response.json()
      console.log('[Generate] ===== PAYMENT INTENT UPDATED SUCCESSFULLY =====')
      console.log('[Generate] Updated data:', data)
      // Clear paymentIntentIdRef after successful update
      paymentIntentIdRef.current = null
    } catch (error) {
      console.error('[Generate] Error updating payment intent:', error)
    }
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
