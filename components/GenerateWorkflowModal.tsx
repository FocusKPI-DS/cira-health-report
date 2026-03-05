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
  onClearState?: () => void // 添加清空状态的回调函数
}

export default function GenerateWorkflowModal({ isOpen, onClose, onComplete, onStartSuccess, onClearState }: GenerateWorkflowModalProps) {
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

      // 清空右侧进度条和详情显示区域
      if (onClearState) {
        onClearState()
      }
    }
  }, [isOpen, onClearState])

  // Handler for generating report - now always free, no payment check
  const handleGenerateReport = async () => {
    if (isSubmitting) return // Prevent double submission
    
    setIsSubmitting(true)
    console.log('[GenerateWorkflowModal] Generating new report (free)')
    try {
      await workflow.startAnalysisGeneration()
    } finally {
      setIsSubmitting(false)
      // 清空右侧进度条和详情显示区域
      if (onClearState) {
        onClearState()
      }
    }
  }

  if (!isOpen) return null

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <button className={styles.closeButton} onClick={onClose}>
          ×
        </button>
        
        <GenerateWorkflowContent
          messages={workflow.messages}
          latestSearchMsgId={workflow.latestSearchMsgId}
          collected={workflow.collected}
          isReadyToStart={workflow.isReadyToStart}
          isLoading={workflow.isLoading}
          phase={workflow.phase}
          countdown={workflow.countdown}
          workflowEndRef={workflow.workflowEndRef}
          sendMessage={workflow.sendMessage}
          toggleProduct={workflow.toggleProduct}
          retrySearch={workflow.retrySearch}
          startAnalysisGeneration={handleGenerateReport}
          styles={styles}
        />
      </div>
    </div>
  )
}
