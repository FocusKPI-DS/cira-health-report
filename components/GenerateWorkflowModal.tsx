'use client'

import { useEffect, useState } from 'react'
import styles from './GenerateWorkflowModal.module.css'
import GenerateWorkflowContent from './GenerateWorkflowContent'
import { useGenerateWorkflow } from '@/lib/useGenerateWorkflow'
import { Hazard } from '@/lib/types'

interface GenerateWorkflowModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete?: (productName: string, intendedUse: string, hazards: Hazard[], analysisId: string) => void
  onStartSuccess?: (analysisId: string, productName: string, intendedUse: string) => void
}

export default function GenerateWorkflowModal({ isOpen, onClose, onComplete, onStartSuccess }: GenerateWorkflowModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const workflow = useGenerateWorkflow({ 
    onComplete: onComplete,
    onStartSuccess: onStartSuccess
  })

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      workflow.reset()
      setIsSubmitting(false)
    }
  }, [isOpen])

  // Handler for generating report - now always free, no payment check
  const handleGenerateReport = async () => {
    if (isSubmitting) return // Prevent double submission
    
    setIsSubmitting(true)
    console.log('[GenerateWorkflowModal] Generating new report (free)')
    try {
      await workflow.startAnalysisGeneration()
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
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
          handleGenerateReport={handleGenerateReport}
          isSubmitting={isSubmitting}
          styles={styles}
        />
      </div>
    </div>
  )
}
