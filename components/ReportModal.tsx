'use client'

import { useState, JSX } from 'react'
import { useRouter } from 'next/navigation'
import styles from './ReportModal.module.css'
import { InfoIcon } from './Icons'
import PHADetailsModal from './PHADetailsModal'
import SignInModal from './SignInModal'
import { Hazard } from '@/lib/types'
import { useAuth } from '@/lib/auth'
import { trackEvent } from '@/lib/analytics'

interface ReportModalProps {
  productName: string
  intendedUse: string
  hazards: Hazard[]
  analysisId: string | null
  onClose: () => void
}

export default function ReportModal({ productName, intendedUse, hazards, analysisId, onClose }: ReportModalProps) {
  const router = useRouter()
  const { user, isAnonymous } = useAuth()
  const [showPHADetailsModal, setShowPHADetailsModal] = useState(false)
  const [selectedHazard, setSelectedHazard] = useState<string>('')
  const [selectedPotentialHarm, setSelectedPotentialHarm] = useState<string>('')
  const [selectedSeverity, setSelectedSeverity] = useState<string>('')
  const [showSignInModal, setShowSignInModal] = useState(false)

  const handleInfoClick = (hazardName: string, potentialHarm: string, severity: string) => {
    setSelectedHazard(hazardName)
    setSelectedPotentialHarm(potentialHarm)
    setSelectedSeverity(severity)
    setShowPHADetailsModal(true)
  }

  const handleGenerateReport = () => {
    trackEvent('click_generate_whole_report', {
      analysis_id: analysisId || undefined,
      product_name: productName,
      user_type: (!user || isAnonymous) ? 'anonymous' : 'authenticated'
    })

    // If user is anonymous, show sign-in modal
    if (!user || isAnonymous) {
      setShowSignInModal(true)
    } else {
      // If user is signed in, directly navigate to results page
      onClose() // Close the preview modal
      const params = new URLSearchParams({
        productName: productName,
        generating: 'true'
      })
      if (intendedUse) {
        params.append('intendedUse', intendedUse)
      }
      if (analysisId) {
        params.append('analysis_id', analysisId)
      }
      params.append('restart', '1')


      router.push(`/results?${params.toString()}`)
    }
  }

  const handleSignInSuccess = () => {
    setShowSignInModal(false)
    onClose() // Close the preview modal
    // Redirect to results page with generating flag
    const params = new URLSearchParams({
      productName: productName,
      generating: 'true'
    })
    if (intendedUse) {
      params.append('intendedUse', intendedUse)
    }
    if (analysisId) {
      params.append('analysis_id', analysisId)
    }
    params.append('restart', '1')
    router.push(`/results?${params.toString()}`)
  }

  const handleCloseSignIn = () => {
    setShowSignInModal(false)
  }

  return (
    <>
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>

          <div className={styles.header}>
            <div className={styles.headerTop}>
              <h2 className={styles.title}>PHA Analysis Report (Preview)</h2>
              <button
                className={styles.generateButton}
                onClick={handleGenerateReport}
              >
                Generate Whole Report
              </button>
            </div>
            <div className={styles.meta}>
              <div className={styles.metaItem}>
                <strong>Product:</strong> {productName}
              </div>
              {intendedUse && (
                <div className={styles.metaItem}>
                  <strong>Intended Use:</strong> {intendedUse}
                </div>
              )}
            </div>
          </div>

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
                      if (severityItem.severity === 'Unprocessed') severityClass = styles.unprocessed
                      else if (severityItem.severity === 'Minor') severityClass = styles.minor
                      else if (severityItem.severity === 'Negligible') severityClass = styles.negligible
                      else if (severityItem.severity === 'Serious') severityClass = styles.serious
                      else if (severityItem.severity === 'Critical') severityClass = styles.critical
                      else if (severityItem.severity === 'Major') severityClass = styles.major

                      rows.push(
                        <tr key={`${hazardIndex}-${harmIndex}-${severityIndex}`} className={styles.tr}>
                          {isFirstHazardRow && (
                            <td className={styles.td} rowSpan={hazard.hazard_rowspan}>
                              {hazard.hazard}
                            </td>
                          )}
                          {isFirstHarmRow && (
                            <td className={styles.td} rowSpan={harmItem.harm_rowspan}>
                              {harmItem.potential_harm}
                            </td>
                          )}
                          <td className={styles.td}>
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
        </div>
      </div>

      {showPHADetailsModal && (
        <PHADetailsModal
          isOpen={showPHADetailsModal}
          onClose={() => setShowPHADetailsModal(false)}
          analysisId={analysisId}
          hazard={selectedHazard}
          potentialHarm={selectedPotentialHarm}
          severity={selectedSeverity}
        />
      )}

      {showSignInModal && (
        <SignInModal
          onClose={handleCloseSignIn}
          onSuccess={handleSignInSuccess}
        />
      )}
    </>
  )
}
