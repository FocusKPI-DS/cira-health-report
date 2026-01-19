'use client'

import { useEffect, useState } from 'react'
import styles from './GenerateWorkflowModal.module.css'
import GenerateWorkflowContent from './GenerateWorkflowContent'
import PaymentModal from './PaymentModal'
import { useGenerateWorkflow } from '@/lib/useGenerateWorkflow'
import { getUserPaymentStatus } from '@/lib/payment-utils'
import { useAuth } from '@/lib/auth'
import { Hazard } from '@/lib/types'

interface GenerateWorkflowModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete?: (productName: string, intendedUse: string, hazards: Hazard[]) => void
}

export default function GenerateWorkflowModal({ isOpen, onClose, onComplete }: GenerateWorkflowModalProps) {
  const { user, loading: authLoading } = useAuth()
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [isFirstTimeUser, setIsFirstTimeUser] = useState<boolean | null>(null)
  const [isCheckingUserStatus, setIsCheckingUserStatus] = useState(false)

  const workflow = useGenerateWorkflow({ onComplete })

  // Check user payment status when modal opens
  useEffect(() => {
    const checkUserStatus = async () => {
      if (!isOpen || authLoading || !user) {
        setIsCheckingUserStatus(false)
        return
      }

      try {
        const status = await getUserPaymentStatus(user.uid)
        setIsFirstTimeUser(status.isFirstTimeUser)
        console.log('[GenerateWorkflowModal] User status:', status)
      } catch (error) {
        console.error('[GenerateWorkflowModal] Error checking user status:', error)
        setIsFirstTimeUser(true)
      } finally {
        setIsCheckingUserStatus(false)
      }
    }

    if (isOpen) {
      setIsCheckingUserStatus(true)
      checkUserStatus()
    }
  }, [isOpen, user, authLoading])

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      workflow.reset()
      setShowPaymentModal(false)
    }
  }, [isOpen])

  // Handler with payment check
  const handleGenerateReportWithPaymentCheck = async () => {
    console.log('[GenerateWorkflowModal] ===== handleGenerateReportWithPaymentCheck CALLED =====')
    
    // If user is not authenticated, proceed as first-time user
    if (!user) {
      console.log('[GenerateWorkflowModal] No user, proceeding as first-time user')
      await workflow.startAnalysisGeneration()
      return
    }

    // If user status hasn't been checked yet, check it now
    if (isFirstTimeUser === null && !isCheckingUserStatus) {
      console.log('[GenerateWorkflowModal] User status not checked yet, checking now...')
      setIsCheckingUserStatus(true)
      try {
        const status = await getUserPaymentStatus(user.uid)
        setIsFirstTimeUser(status.isFirstTimeUser)
        console.log('[GenerateWorkflowModal] User status checked:', status)
        
        // After checking, proceed with the logic
        if (status.isFirstTimeUser) {
          console.log('[GenerateWorkflowModal] First-time user, generating without payment')
          await workflow.startAnalysisGeneration()
        } else {
          console.log('[GenerateWorkflowModal] Returning user, showing payment modal')
          setShowPaymentModal(true)
        }
      } catch (error) {
        console.error('[GenerateWorkflowModal] Error checking user status:', error)
        setIsFirstTimeUser(true)
        await workflow.startAnalysisGeneration()
      } finally {
        setIsCheckingUserStatus(false)
      }
      return
    }

    // If still checking, proceed as first-time user for better UX
    if (isCheckingUserStatus) {
      console.log('[GenerateWorkflowModal] User status check in progress, proceeding as first-time user')
      await workflow.startAnalysisGeneration()
      return
    }

    // If first-time user, skip payment and generate directly
    if (isFirstTimeUser === true) {
      console.log('[GenerateWorkflowModal] First-time user, generating without payment')
      await workflow.startAnalysisGeneration()
      return
    }

    // Returning user - show payment modal
    console.log('[GenerateWorkflowModal] Returning user, showing payment modal')
    setShowPaymentModal(true)
  }

  const handlePaymentClose = () => {
    setShowPaymentModal(false)
  }

  const handlePaymentSuccess = async () => {
    setShowPaymentModal(false)
    // After successful payment, start the analysis generation
    await workflow.startAnalysisGeneration()
  }

  if (!isOpen) return null

  return (
    <>
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
          
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
          />
        </div>
      </div>

      {showPaymentModal && (
        <PaymentModal
          onClose={handlePaymentClose}
          onSuccess={handlePaymentSuccess}
          productName={workflow.productName}
          amount={5.00}
          purpose="generation"
        />
      )}
    </>
  )
}
