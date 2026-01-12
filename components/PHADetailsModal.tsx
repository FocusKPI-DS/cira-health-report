'use client'

import { useState } from 'react'
import styles from './PHADetailsModal.module.css'
import { ExternalLinkIcon } from '@/components/Icons'

interface HazardousSituation {
  id: string
  situation: string
  severityReasoning: string
  referenceLink?: string
}

interface PHADetails {
  hazard: string
  potentialHarm: string
  severity: string[]
  hazardousSituations: HazardousSituation[]
}

interface PHADetailsModalProps {
  isOpen: boolean
  onClose: () => void
  hazard: PHADetails | null
}

export default function PHADetailsModal({ isOpen, onClose, hazard }: PHADetailsModalProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const recordsPerPage = 10

  if (!isOpen || !hazard) return null

  const startIndex = (currentPage - 1) * recordsPerPage
  const endIndex = startIndex + recordsPerPage
  const currentSituations = hazard.hazardousSituations.slice(startIndex, endIndex)
  const totalPages = Math.ceil(hazard.hazardousSituations.length / recordsPerPage)

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>PHA Analysis Details</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.formSection}>
          <div className={styles.formRow}>
            <div className={styles.formField}>
              <label className={styles.label}>Hazard</label>
              <div className={styles.valueText}>{hazard.hazard}</div>
            </div>
            <div className={styles.formField}>
              <label className={styles.label}>Potential Harm</label>
              <div className={styles.valueText}>{hazard.potentialHarm}</div>
            </div>
            <div className={styles.formField}>
              <label className={styles.label}>Severity</label>
              <div className={styles.severityDisplay}>
                {hazard.severity.map((sev, i) => (
                  <span key={i} className={styles.severityTag}>{sev}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.situationsSection}>
          <h3 className={styles.sectionTitle}>
            Hazardous Situations ({hazard.hazardousSituations.length} record{hazard.hazardousSituations.length !== 1 ? 's' : ''})
          </h3>
          <div className={styles.situationsList}>
            {currentSituations.map((situation) => (
              <div key={situation.id} className={styles.situationCard}>
                <div className={styles.situationField}>
                  <label className={styles.situationLabel}>Hazardous Situation</label>
                  <div className={styles.valueText}>{situation.situation}</div>
                </div>
                <div className={styles.situationField}>
                  <label className={styles.situationLabel}>Severity Reasoning</label>
                  <div className={styles.valueText}>{situation.severityReasoning}</div>
                </div>
                <div className={styles.situationActions}>
                  {situation.referenceLink ? (
                    <a 
                      href={situation.referenceLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.referenceButton}
                      title="View Reference"
                    >
                      <ExternalLinkIcon />
                    </a>
                  ) : (
                    <button className={styles.referenceButton} disabled title="No Reference">
                      <ExternalLinkIcon />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.pagination}>
          <span className={styles.paginationText}>
            Records {startIndex + 1}-{Math.min(endIndex, hazard.hazardousSituations.length)} of {hazard.hazardousSituations.length}
          </span>
          <div className={styles.paginationControls}>
            <span className={styles.paginationLabel}>Per page:</span>
            <select className={styles.perPageSelect} defaultValue="10">
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
            <button
              className={styles.paginationButton}
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              Prev
            </button>
            <span className={styles.pageInfo}>
              Page <input
                type="number"
                value={currentPage}
                onChange={(e) => {
                  const page = parseInt(e.target.value)
                  if (page >= 1 && page <= totalPages) {
                    setCurrentPage(page)
                  }
                }}
                className={styles.pageInput}
                min={1}
                max={totalPages}
              /> of {totalPages}
            </span>
            <button
              className={styles.paginationButton}
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

