'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './ReportModal.module.css'
import { InfoIcon } from './Icons'
import PHADetailsModal from './PHADetailsModal'
import SignInModal from './SignInModal'

interface Hazard {
  hazard: string
  potentialHarm: string
  severity: string[]
}

interface PHADetails {
  hazard: string
  potentialHarm: string
  severity: string[]
  hazardousSituations: {
    id: string
    situation: string
    severityReasoning: string
    referenceLink?: string
  }[]
}

interface ReportModalProps {
  productName: string
  intendedUse: string
  hazards: Hazard[]
  onClose: () => void
}

export default function ReportModal({ productName, intendedUse, hazards, onClose }: ReportModalProps) {
  const router = useRouter()
  const [showPHADetailsModal, setShowPHADetailsModal] = useState(false)
  const [selectedHazard, setSelectedHazard] = useState<PHADetails | null>(null)
  const [showSignInModal, setShowSignInModal] = useState(false)

  const handleInfoClick = (hazard: Hazard, severity: string) => {
    const phaDetails: PHADetails = {
      hazard: hazard.hazard,
      potentialHarm: hazard.potentialHarm,
      severity: [severity], // Only show the selected severity
      hazardousSituations: [
        {
          id: '1',
          situation: 'The user experienced a device that could not maintain a charge, leading to uncertainty about its operational status.',
          severityReasoning: 'The device was physically damaged and unable to hold a charge, which could lead to inconvenience and temporary issues but did not result in any reported injuries requiring medical intervention.',
          referenceLink: 'https://www.fda.gov/medical-devices/device-advice-comprehensive-regulatory-assistance/medical-device-databases'
        }
      ]
    }
    setSelectedHazard(phaDetails)
    setShowPHADetailsModal(true)
  }

  const handleGenerateReport = () => {
    setShowSignInModal(true)
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
                {hazards.flatMap((hazard, hazardIndex) => 
                  hazard.severity.map((sev, severityIndex) => {
                    let severityClass = styles.negligible
                    if (sev === 'Minor') severityClass = styles.minor
                    else if (sev === 'Moderate') severityClass = styles.moderate
                    else if (sev === 'Critical') severityClass = styles.critical
                    else if (sev === 'Major') severityClass = styles.moderate // Use moderate style for Major
                    
                    const row = (
                      <tr key={`${hazardIndex}-${severityIndex}`} className={styles.tr}>
                        {severityIndex === 0 && (
                          <td className={styles.td} rowSpan={hazard.severity.length}>
                            {hazard.hazard}
                          </td>
                        )}
                        <td className={styles.td}>{hazard.potentialHarm}</td>
                        <td className={styles.td}>
                          <span className={`${styles.severityBadge} ${severityClass}`}>
                            {sev}
                          </span>
                        </td>
                        <td className={styles.td}>
                          <button 
                            className={styles.infoButton} 
                            title="Detail"
                            onClick={() => handleInfoClick(hazard, sev)}
                          >
                            <InfoIcon />
                          </button>
                        </td>
                      </tr>
                    )
                    return row
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showPHADetailsModal && selectedHazard && (
        <PHADetailsModal
          isOpen={showPHADetailsModal}
          onClose={() => setShowPHADetailsModal(false)}
          hazard={selectedHazard}
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
