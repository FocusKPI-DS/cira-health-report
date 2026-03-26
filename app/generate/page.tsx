'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import styles from './page.module.css'
import Header from '@/components/Header'
import ReportModal from '@/components/ReportModal'
import GenerateWorkflowContent from '@/components/GenerateWorkflowContent'
import { useGenerateWorkflow } from '@/lib/useGenerateWorkflow'
import { Hazard } from '@/lib/types'
import { trackEvent } from '@/lib/analytics'

function GenerateContent() {
  const searchParams = useSearchParams()
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportData, setReportData] = useState<Hazard[]>([])

  const initialProductName = searchParams.get('productName') || ''

  const workflow = useGenerateWorkflow({ initialProductName })

  const handleViewReport = async () => {
    trackEvent('view_report_modal', {
      analysis_id: workflow.analysisId || undefined,
      product_name: workflow.productName || undefined
    })
    if (workflow.analysisId) {
      try {
        const hazards = await workflow.fetchReportData()
        setReportData(hazards)
        setShowReportModal(true)
      } catch (error) {
        console.error('Error fetching report data:', error)
        alert(error instanceof Error ? error.message : 'Failed to load report data')
      }
    } else {
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
          <button className={styles.viewReportButton} onClick={handleViewReport}>
            View Report
          </button>
          <button className={styles.newReportButton} onClick={handleStartNewReport}>
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
          messages={workflow.messages}
          latestSearchMsgId={workflow.latestSearchMsgId}
          initialInputText={initialProductName || undefined}
          collected={workflow.collected}
          isReadyToStart={workflow.isReadyToStart}
          isLoading={workflow.isLoading}
          phase={workflow.phase}
          countdown={workflow.countdown}
          workflowEndRef={workflow.workflowEndRef}
          sendMessage={workflow.sendMessage}
          toggleProduct={workflow.toggleProduct}
          toggleDbItem={workflow.toggleDbItem}
          dbSearchSelection={workflow.dbSearchSelection}
          retrySearch={workflow.retrySearch}
          startAnalysisGeneration={workflow.startAnalysisGeneration}
          answerModuleQuestion={workflow.answerModuleQuestion}
          confirmAndGenerate={workflow.confirmAndGenerate}
          submitIsoChecklist={workflow.submitIsoChecklist}
          isReadyToGenerate={workflow.isReadyToGenerate}
          pendingModeSelection={workflow.pendingModeSelection}
          selectAnalysisMode={workflow.selectAnalysisMode}
          searchStartDate={workflow.searchStartDate}
          searchEndDate={workflow.searchEndDate}
          setSearchStartDate={workflow.setSearchStartDate}
          setSearchEndDate={workflow.setSearchEndDate}
          styles={styles}
          renderCompleted={renderCompleted}
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
