'use client'

import { useState } from 'react'
import styles from './PaymentModal.module.css'
import { LockIcon } from './Icons'

interface PaymentModalProps {
  onClose: () => void
  onSuccess: () => void
}

export default function PaymentModal({ onClose, onSuccess }: PaymentModalProps) {
  const [cardNumber, setCardNumber] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [cvv, setCvv] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsProcessing(true)
    
    // Simulate payment processing
    setTimeout(() => {
      console.log('Payment processed:', { cardNumber, expiryDate, cvv })
      setIsProcessing(false)
      onSuccess()
    }, 1500)
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>
          ×
        </button>
        <h2 className={styles.title}>Download Full Report</h2>
        <p className={styles.subtitle}>
          Complete your purchase to download the comprehensive PHA analysis
        </p>
        
        <div className={styles.priceSection}>
          <div className={styles.priceLabel}>Total</div>
          <div className={styles.priceAmount}>$5.00</div>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="cardNumber" className={styles.label}>
              Card Number
            </label>
            <input
              id="cardNumber"
              type="text"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              className={styles.input}
              placeholder="1234 5678 9012 3456"
              maxLength={19}
              required
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="expiryDate" className={styles.label}>
                Expiry Date
              </label>
              <input
                id="expiryDate"
                type="text"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className={styles.input}
                placeholder="MM/YY"
                maxLength={5}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="cvv" className={styles.label}>
                CVV
              </label>
              <input
                id="cvv"
                type="text"
                value={cvv}
                onChange={(e) => setCvv(e.target.value)}
                className={styles.input}
                placeholder="123"
                maxLength={4}
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className={styles.payButton}
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : 'Pay $5.00'}
          </button>
        </form>

        <p className={styles.footerText}>
          <LockIcon />
          Secure payment powered by Stripe
        </p>
      </div>
    </div>
  )
}

