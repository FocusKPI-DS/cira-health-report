'use client'

import { useState, useEffect } from 'react'
import styles from './AddDatasourceModal.module.css'
import { getAuthHeaders } from '../lib/api-utils'

// Google Analytics type declaration
declare global {
  interface Window {
    gtag?: (command: string, ...args: any[]) => void
  }
}

interface AddDatasourceModalProps {
  isOpen: boolean
  onClose: () => void
}

// API base URL - same as other API calls in the project
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'

export default function AddDatasourceModal({ isOpen, onClose }: AddDatasourceModalProps) {
  const [datasource, setDatasource] = useState('')
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [countdown, setCountdown] = useState(5)

  // Countdown timer effect
  useEffect(() => {
    if (showSuccess && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else if (showSuccess && countdown === 0) {
      handleClose()
    }
  }, [showSuccess, countdown])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Track save add datasource event in GA4
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'save_add_datasource', {
        datasource: datasource.substring(0, 100), // Limit to 100 chars for GA4
        has_reason: !!reason
      })
    }

    try {
      // Get authentication headers
      const headers = await getAuthHeaders()
      
      const response = await fetch(`${API_URL}/api/v1/anonclient/client_datasource/add`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          datasource,
          reason: reason || null,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to submit datasource request')
      }

      const data = await response.json()
      
      if (data.success) {
        // Show success message and start countdown
        setShowSuccess(true)
        setCountdown(5)
      }
    } catch (error) {
      console.error('Error submitting datasource:', error)
      alert('Failed to submit datasource request. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    setDatasource('')
    setReason('')
    setShowSuccess(false)
    setCountdown(5)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={handleClose}>
          ×
        </button>
        
        {showSuccess ? (
          <div className={styles.successContainer}>
            <div className={styles.successIcon}>✓</div>
            <h2 className={styles.successTitle}>Request Submitted Successfully!</h2>
            <p className={styles.successMessage}>
              Your datasource request has been submitted. We'll review it and get back to you soon.
            </p>
            <p className={styles.countdown}>
              Closing in {countdown} second{countdown !== 1 ? 's' : ''}...
            </p>
          </div>
        ) : (
          <>
            <div className={styles.header}>
              <h2 className={styles.title}>Add New Datasource</h2>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label htmlFor="datasource" className={styles.label}>
                  Datasource <span className={styles.required}>*</span>
                </label>
                <textarea
                  id="datasource"
                  value={datasource}
                  onChange={(e) => setDatasource(e.target.value)}
                  className={styles.textarea}
                  placeholder="Describe the datasource you want to add"
                  required
                  rows={4}
                  disabled={isSubmitting}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="reason" className={styles.label}>
                  Reason <span className={styles.optional}>(optional)</span>
                </label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={styles.textarea}
                  placeholder="Why do you need this datasource?"
                  rows={3}
                  disabled={isSubmitting}
                />
              </div>

              <div className={styles.actions}>
                <button 
                  type="button" 
                  className={styles.cancelButton} 
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className={styles.submitButton}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
