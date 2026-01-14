'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import styles from './page.module.css'
import Header from '@/components/Header'
import ReportModal from '@/components/ReportModal'
import GenerateWorkflowContent from '@/components/GenerateWorkflowContent'
import { useGenerateWorkflow } from '@/lib/useGenerateWorkflow'
import { Hazard } from '@/lib/types'

function GenerateContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportData, setReportData] = useState<Hazard[]>([])

  const initialProductName = searchParams.get('productName') || ''
  
  const workflow = useGenerateWorkflow({
    initialProductName,
    onComplete: (productName, intendedUse, hazards) => {
      setReportData(hazards)
      workflow.setCurrentStep('completed')
    }
  })

  const handleViewReport = () => {
    setShowReportModal(true)
  }

  const handleStartNewReport = () => {
    workflow.reset()
    setReportData([])
    setShowReportModal(false)
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
      <Header showAuthButtons={true} />

      <div className={styles.container}>
        <GenerateWorkflowContent
          messageHistory={workflow.messageHistory}
          currentStep={workflow.currentStep}
          productName={workflow.productName}
          setProductName={workflow.setProductName}
          intendedUse={workflow.intendedUse}
          setIntendedUse={workflow.setIntendedUse}
          selectedProducts={workflow.selectedProducts}
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
        />
      </div>

      {showReportModal && (
        <ReportModal
          productName={workflow.productName}
          intendedUse={workflow.intendedUse}
          hazards={reportData}
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
