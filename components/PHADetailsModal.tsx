'use client'

import { useState, useEffect } from 'react'
import styles from './PHADetailsModal.module.css'
import { ExternalLinkIcon } from '@/components/Icons'
import { analysisApi } from '@/lib/analysis-api'

interface HazardousSituation {
  id: number
  hazardous_situation: string
  severity_reasoning: string
  source?: string
}

interface PHADetailsModalProps {
  isOpen: boolean
  onClose: () => void
  analysisId: string | null
  hazard: string
  potentialHarm: string
  severity: string
}

export default function PHADetailsModal({ isOpen, onClose, analysisId, hazard, potentialHarm, severity }: PHADetailsModalProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [recordsPerPage, setRecordsPerPage] = useState(10)
  const [isLoading, setIsLoading] = useState(false)
  const [situations, setSituations] = useState<HazardousSituation[]>([])
  const [totalCount, setTotalCount] = useState(0)

  // Fetch data when modal opens or parameters change
  useEffect(() => {
    if (!isOpen || !analysisId || !hazard || !potentialHarm || !severity) {
      setSituations([])
      setTotalCount(0)
      return
    }

    const fetchData = async () => {
      setIsLoading(true)
      try {
        const data = await analysisApi.fetchGroupRecords(analysisId, hazard, potentialHarm, severity)
        setSituations(data.records || [])
        setTotalCount(data.count || 0)
      } catch (error) {
        console.error('[PHADetailsModal] Error fetching group records:', error)
        setSituations([])
        setTotalCount(0)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [isOpen, analysisId, hazard, potentialHarm, severity])

  // Reset to page 1 when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(1)
    }
  }, [isOpen])

  if (!isOpen) return null

  const startIndex = (currentPage - 1) * recordsPerPage
  const endIndex = startIndex + recordsPerPage
  const currentSituations = situations.slice(startIndex, endIndex)
  const totalPages = Math.ceil(situations.length / recordsPerPage)

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
              <div className={styles.valueText}>{hazard}</div>
            </div>
            <div className={styles.formField}>
              <label className={styles.label}>Potential Harm</label>
              <div className={styles.valueText}>{potentialHarm}</div>
            </div>
            <div className={styles.formField}>
              <label className={styles.label}>Severity</label>
              <div className={styles.severityDisplay}>
                <span className={styles.severityTag}>{severity}</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.situationsSection}>
          <h3 className={styles.sectionTitle}>
            Hazardous Situations ({totalCount} record{totalCount !== 1 ? 's' : ''})
          </h3>
          {isLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
              Loading hazardous situations...
            </div>
          ) : situations.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
              No hazardous situations found
            </div>
          ) : (
            <div className={styles.situationsList}>
              {currentSituations.map((situation) => (
                <div key={situation.id} className={styles.situationCard}>
                  <div className={styles.situationField}>
                    <label className={styles.situationLabel}>Hazardous Situation</label>
                    <div className={styles.valueText}>{situation.hazardous_situation}</div>
                  </div>
                  <div className={styles.situationField}>
                    <label className={styles.situationLabel}>Severity Reasoning</label>
                    <div className={styles.valueText}>{situation.severity_reasoning}</div>
                  </div>
                  <div className={styles.situationActions}>
                    {situation.source ? (
                      <a 
                        href={situation.source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.referenceButton}
                        title="View Source"
                      >
                        <ExternalLinkIcon />
                      </a>
                    ) : (
                      <button className={styles.referenceButton} disabled title="No Source">
                        <ExternalLinkIcon />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {situations.length > 0 && (
          <div className={styles.pagination}>
            <span className={styles.paginationText}>
              Records {startIndex + 1}-{Math.min(endIndex, situations.length)} of {situations.length}
            </span>
            <div className={styles.paginationControls}>
              <span className={styles.paginationLabel}>Per page:</span>
              <select 
                className={styles.perPageSelect} 
                value={recordsPerPage}
                onChange={(e) => {
                  setRecordsPerPage(parseInt(e.target.value))
                  setCurrentPage(1)
                }}
              >
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
        )}
      </div>
    </div>
  )
}

