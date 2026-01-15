'use client'

import { useEffect } from 'react'
import styles from './GenerateWorkflowModal.module.css'
import GenerateWorkflowContent from './GenerateWorkflowContent'
import { useGenerateWorkflow } from '@/lib/useGenerateWorkflow'
import { Hazard } from '@/lib/types'

interface GenerateWorkflowModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete?: (productName: string, intendedUse: string, hazards: Hazard[]) => void
}

export default function GenerateWorkflowModal({ isOpen, onClose, onComplete }: GenerateWorkflowModalProps) {
  const workflow = useGenerateWorkflow({ onComplete })

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      workflow.reset()
    }
  }, [isOpen])

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
            handleGenerateReport={workflow.handleGenerateReport}
            styles={styles}
          />
        </div>
      </div>
    </>
  )
}
