'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { Transaction } from '@/lib/types/stripe'
import styles from './ReceiptModal.module.css'

interface ReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  transaction: Transaction
  purpose?: 'generation' | 'download'
}

export default function ReceiptModal({ isOpen, onClose, transaction, purpose }: ReceiptModalProps) {
  const { user } = useAuth()
  const [fullTransaction, setFullTransaction] = useState<Transaction>(transaction)
  const [isLoading, setIsLoading] = useState(false)

  // Fetch payment method details if not available
  useEffect(() => {
    if (isOpen && !transaction.paymentMethod) {
      setIsLoading(true)
      fetch(`/api/payments/receipt?paymentIntentId=${encodeURIComponent(transaction.paymentIntentId)}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.transaction) {
            setFullTransaction(data.transaction)
          }
        })
        .catch(err => {
          console.error('[ReceiptModal] Error fetching receipt details:', err)
        })
        .finally(() => {
          setIsLoading(false)
        })
    } else {
      setFullTransaction(transaction)
    }
  }, [isOpen, transaction])

  if (!isOpen) return null

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Format currency
  const formatCurrency = (amount: number, currency: string = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount)
  }

  // Extract receipt number from receiptUrl or use paymentIntentId
  const getReceiptNumber = () => {
    if (fullTransaction.receiptNumber) {
      return fullTransaction.receiptNumber
    }
    // Extract from paymentIntentId (last 12 chars for readability)
    if (fullTransaction.paymentIntentId) {
      return fullTransaction.paymentIntentId.slice(-12).toUpperCase()
    }
    return fullTransaction.id.slice(-12).toUpperCase()
  }

  // Format payment method
  const getPaymentMethodDisplay = () => {
    if (fullTransaction.paymentMethod?.card) {
      const brand = fullTransaction.paymentMethod.card.brand.charAt(0).toUpperCase() + 
                   fullTransaction.paymentMethod.card.brand.slice(1)
      return `${brand} •••• ${fullTransaction.paymentMethod.card.last4}`
    }
    if (isLoading) {
      return 'Loading...'
    }
    return 'Card payment'
  }

  // Get purpose display text
  const getPurposeText = () => {
    if (purpose === 'generation') {
      return 'Analysis Generation'
    } else if (purpose === 'download') {
      return 'Report Download'
    }
    return 'Payment'
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Receipt</h2>
        </div>

        <div className={styles.content}>
          {/* Company Information */}
          <div className={styles.companySection}>
            <h3 className={styles.companyName}>FocusKPI</h3>
            <p className={styles.companyAddress}>
              123 Business Street<br />
              City, State 12345<br />
              United States
            </p>
          </div>

          {/* Receipt Details */}
          <div className={styles.receiptSection}>
            <div className={styles.receiptRow}>
              <span className={styles.label}>Receipt Number:</span>
              <span className={styles.value}>{getReceiptNumber()}</span>
            </div>
            <div className={styles.receiptRow}>
              <span className={styles.label}>Date:</span>
              <span className={styles.value}>{formatDate(fullTransaction.createdAt)}</span>
            </div>
            <div className={styles.receiptRow}>
              <span className={styles.label}>Payment ID:</span>
              <span className={styles.value}>{fullTransaction.paymentIntentId.slice(-12)}</span>
            </div>
          </div>

          {/* Payment Information */}
          <div className={styles.paymentSection}>
            <h4 className={styles.sectionTitle}>Payment Details</h4>
            <div className={styles.receiptRow}>
              <span className={styles.label}>Amount:</span>
              <span className={styles.amountValue}>
                {formatCurrency(fullTransaction.amount, fullTransaction.currency)}
              </span>
            </div>
            <div className={styles.receiptRow}>
              <span className={styles.label}>Payment Method:</span>
              <span className={styles.value}>{getPaymentMethodDisplay()}</span>
            </div>
            <div className={styles.receiptRow}>
              <span className={styles.label}>Status:</span>
              <span className={`${styles.status} ${styles.statusSuccess}`}>
                {fullTransaction.status.charAt(0).toUpperCase() + fullTransaction.status.slice(1)}
              </span>
            </div>
            <div className={styles.receiptRow}>
              <span className={styles.label}>Purpose:</span>
              <span className={styles.value}>{getPurposeText()}</span>
            </div>
          </div>

          {/* Product Information */}
          {fullTransaction.productName && (
            <div className={styles.productSection}>
              <h4 className={styles.sectionTitle}>Product Information</h4>
              <div className={styles.receiptRow}>
                <span className={styles.label}>Product Name:</span>
                <span className={styles.value}>{fullTransaction.productName}</span>
              </div>
              {fullTransaction.analysisId && (
                <div className={styles.receiptRow}>
                  <span className={styles.label}>Analysis ID:</span>
                  <span className={styles.value}>{fullTransaction.analysisId}</span>
                </div>
              )}
            </div>
          )}

          {/* Customer Information */}
          <div className={styles.customerSection}>
            <h4 className={styles.sectionTitle}>Customer Information</h4>
            {user?.email && (
              <div className={styles.receiptRow}>
                <span className={styles.label}>Email:</span>
                <span className={styles.value}>{user.email}</span>
              </div>
            )}
            {user?.displayName && (
              <div className={styles.receiptRow}>
                <span className={styles.label}>Name:</span>
                <span className={styles.value}>{user.displayName}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={styles.footer}>
            <p className={styles.footerText}>
              Thank you for your payment!
            </p>
            {fullTransaction.receiptUrl && (
              <a 
                href={fullTransaction.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.stripeLink}
              >
                View on Stripe
              </a>
            )}
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.closeButton} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

