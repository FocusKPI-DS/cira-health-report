'use client'

import { useState } from 'react'
import styles from './AddDatasourceModal.module.css'

interface AddDatasourceModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AddDatasourceModal({ isOpen, onClose }: AddDatasourceModalProps) {
  const [datasource, setDatasource] = useState('')
  const [reason, setReason] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: Handle form submission
    console.log('Datasource:', datasource)
    console.log('Reason:', reason)
    // Reset form and close modal
    setDatasource('')
    setReason('')
    onClose()
    // Could show success message here
  }

  const handleClose = () => {
    setDatasource('')
    setReason('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={handleClose}>
          ×
        </button>
        
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
            />
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.cancelButton} onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className={styles.submitButton}>
              Submit Request
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
