'use client'

import { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import styles from './PaymentModal.module.css'
import { LockIcon, DownloadIcon } from './Icons'
import { useAuth } from '@/lib/auth'
import { Transaction } from '@/lib/types/stripe'

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')

type PaymentPurpose = 'generation' | 'download'

interface PaymentModalProps {
  onClose: () => void
  onSuccess: (paymentIntentId?: string) => void // Pass paymentIntentId on success
  reportId?: string
  analysisId?: string
  productName?: string
  amount?: number
  purpose?: PaymentPurpose // 'generation' = payment before generating analysis, 'download' = payment for downloading report
}

type TabType = 'payment' | 'history'

// Payment form component (must be inside Elements wrapper)
function PaymentFormInner({ 
  onSuccess, 
  onClose, 
  reportId, 
  productName, 
  amount = 5.00,
  clientSecret,
  onProcessingChange
}: {
  onSuccess: (paymentIntentId?: string) => void
  onClose: () => void
  reportId?: string
  productName?: string
  amount?: number
  clientSecret: string
  onProcessingChange?: (isProcessing: boolean) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Notify parent when processing state changes
  useEffect(() => {
    if (onProcessingChange) {
      onProcessingChange(isProcessing)
    }
  }, [isProcessing, onProcessingChange])


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements || !clientSecret) {
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      // Submit payment
      const { error: submitError } = await elements.submit()
      if (submitError) {
        setError(submitError.message || 'Payment submission failed')
        setIsProcessing(false)
        return
      }

      // Confirm payment
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: 'if_required',
      })

      if (confirmError) {
        setError(confirmError.message || 'Payment failed')
        setIsProcessing(false)
        return
      }

      if (!paymentIntent) {
        setError('Payment intent not found')
        setIsProcessing(false)
        return
      }

      // Payment succeeded - confirm with backend
      const confirmResponse = await fetch('/api/payments/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentIntentId: paymentIntent.id,
        }),
      })

      if (!confirmResponse.ok) {
        throw new Error('Failed to confirm payment')
      }

      // Success! Pass paymentIntentId to parent
      onSuccess(paymentIntent.id)
    } catch (err: any) {
      setError(err.message || 'Payment processing failed')
      console.error('[Payment] Error:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}
      
      <div className={styles.paymentElementWrapper}>
        <PaymentElement />
      </div>

      <button 
        type="submit" 
        className={styles.payButton}
        disabled={isProcessing || !stripe}
      >
        {isProcessing ? 'Processing...' : `Pay $${amount.toFixed(2)}`}
      </button>
    </form>
  )
}

// Payment form wrapper that handles clientSecret fetching
function PaymentForm({ 
  onSuccess, 
  onClose, 
  reportId, 
  analysisId,
  productName, 
  amount = 5.00,
  onProcessingChange
}: {
  onSuccess: (paymentIntentId?: string) => void
  onClose: () => void
  reportId?: string
  analysisId?: string
  productName?: string
  amount?: number
  onProcessingChange?: (isProcessing: boolean) => void
}) {
  const { user } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)

  // Create payment intent only when user is ready to pay
  const handleInitializePayment = async () => {
    console.log('[PaymentForm] handleInitializePayment called')
    console.log('[PaymentForm] user:', user?.uid)
    console.log('[PaymentForm] clientSecret exists:', !!clientSecret)
    
    if (!user) {
      console.error('[PaymentForm] No user found')
      setError('Please log in to make a payment')
      return
    }

    if (clientSecret) {
      // Already initialized
      console.log('[PaymentForm] Payment already initialized')
      return
    }

    setIsInitializing(true)
    setError(null)
    console.log('[PaymentForm] Starting payment initialization...')

    try {
      console.log('[PaymentForm] Sending request to /api/payments/create-intent')
      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amount,
          currency: 'usd',
          reportId: reportId,
          analysisId: analysisId || reportId, // Use analysisId if provided, otherwise fallback to reportId
          userId: user.uid,
          productName: productName,
        }),
      })

      console.log('[PaymentForm] Response status:', response.status)
      console.log('[PaymentForm] Response ok:', response.ok)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('[PaymentForm] Error response:', errorData)
        throw new Error(errorData.error || 'Failed to create payment intent')
      }

      const data = await response.json()
      console.log('[PaymentForm] Received data:', data)
      console.log('[PaymentForm] Client secret:', data.clientSecret ? 'present' : 'missing')
      
      setClientSecret(data.clientSecret)
      console.log('[PaymentForm] Client secret set successfully')
    } catch (err: any) {
      console.error('[PaymentForm] Error caught:', err)
      setError(err.message || 'Failed to initialize payment')
    } finally {
      setIsInitializing(false)
      console.log('[PaymentForm] Initialization complete')
    }
  }

  // Show initial state - user needs to click to proceed
  if (!clientSecret) {
    console.log('[PaymentForm] Rendering init state, clientSecret:', clientSecret)
    return (
      <div className={styles.paymentInitState}>
        <p className={styles.initText}>
          Click the button below to proceed with payment
        </p>
        <button
          type="button"
          className={styles.initButton}
          onClick={handleInitializePayment}
          disabled={isInitializing || !user}
        >
          {isInitializing ? (
            <>
              <div className={styles.spinner}></div>
              Initializing payment...
            </>
          ) : (
            `Proceed to Payment - $${amount.toFixed(2)}`
          )}
        </button>
        {error && (
          <div className={styles.errorMessage}>
            {error}
          </div>
        )}
      </div>
    )
  }

  console.log('[PaymentForm] Rendering payment element with clientSecret')
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <PaymentFormInner
        onSuccess={onSuccess}
        onClose={onClose}
        reportId={reportId}
        productName={productName}
        amount={amount}
        clientSecret={clientSecret}
        onProcessingChange={onProcessingChange}
      />
    </Elements>
  )
}

// Transaction history component
function TransactionHistory({ userId }: { userId: string }) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/payments/transactions?userId=${encodeURIComponent(userId)}`)

        if (!response.ok) {
          throw new Error('Failed to fetch transactions')
        }

        const data = await response.json()
        setTransactions(data.transactions || [])
      } catch (err: any) {
        setError(err.message || 'Failed to load transactions')
        console.error('[Transactions] Error:', err)
      } finally {
        setLoading(false)
      }
    }

    if (userId) {
      fetchTransactions()
    }
  }, [userId])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (amount: number, currency: string = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount)
  }

  const getStatusClass = (status: Transaction['status']) => {
    switch (status) {
      case 'succeeded':
        return styles.statusSuccess
      case 'failed':
        return styles.statusFailed
      case 'refunded':
        return styles.statusRefunded
      case 'pending':
        return styles.statusPending
      case 'canceled':
        return styles.statusCanceled
      default:
        return ''
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner}></div>
        <p>Loading transactions...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.errorMessage}>
        {error}
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyText}>No transactions yet</p>
        <p className={styles.emptySubtext}>
          Your payment history will appear here
        </p>
      </div>
    )
  }

  return (
    <div className={styles.transactionsList}>
      {transactions.map((transaction) => (
        <div key={transaction.id} className={styles.transactionCard}>
          <div className={styles.transactionHeader}>
            <div className={styles.transactionInfo}>
              <h4 className={styles.transactionId}>
                {transaction.description || `Payment ${transaction.id.slice(-8)}`}
              </h4>
              <p className={styles.transactionDate}>{formatDate(transaction.createdAt)}</p>
            </div>
            <div className={styles.transactionAmount}>
              <span className={styles.amount}>{formatCurrency(transaction.amount, transaction.currency)}</span>
              <span className={`${styles.status} ${getStatusClass(transaction.status)}`}>
                {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
              </span>
            </div>
          </div>
          
          {transaction.productName && (
            <p className={styles.transactionProduct}>
              Report: <strong>{transaction.productName}</strong>
            </p>
          )}

          {transaction.status === 'succeeded' && transaction.receiptUrl && (
            <div className={styles.transactionActions}>
              <a 
                href={transaction.receiptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.receiptLink}
              >
                <DownloadIcon />
                View Receipt
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// Main PaymentModal component
export default function PaymentModal({ 
  onClose, 
  onSuccess, 
  reportId,
  analysisId, 
  productName, 
  amount = 5.00,
  purpose = 'download' // Default to download for backward compatibility
}: PaymentModalProps) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('payment')
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false)

  // Handle modal close - PaymentForm will handle canceling PaymentIntent if needed
  const handleClose = () => {
    // Prevent closing if payment is processing
    if (isPaymentProcessing) {
      return
    }
    onClose()
  }

  return (
    <div 
      className={styles.overlay} 
      onClick={handleClose}
      style={{ cursor: isPaymentProcessing ? 'not-allowed' : 'pointer' }}
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button 
          className={styles.closeButton} 
          onClick={handleClose}
          disabled={isPaymentProcessing}
          style={{ 
            opacity: isPaymentProcessing ? 0.5 : 1,
            cursor: isPaymentProcessing ? 'not-allowed' : 'pointer'
          }}
          title={isPaymentProcessing ? 'Payment is processing, please wait...' : 'Close'}
        >
          ×
        </button>
        
        <div className={styles.modalHeader}>
          <h2 className={styles.title}>
            {purpose === 'generation' ? 'Generate Analysis' : 'Download Full Report'}
          </h2>
          <p className={styles.subtitle}>
            {purpose === 'generation' 
              ? 'Complete your purchase to generate the comprehensive PHA analysis'
              : 'Complete your purchase to download the comprehensive PHA analysis'}
          </p>
        </div>

        <div className={styles.modalContent}>
          <div className={styles.priceSection}>
            <div className={styles.priceLabel}>Total</div>
            <div className={styles.priceAmount}>${amount.toFixed(2)}</div>
          </div>

          {/* Tabs */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'payment' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('payment')}
            >
              Payment
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'history' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('history')}
            >
              Transaction History
            </button>
          </div>

          {/* Tab Content */}
          <div className={styles.tabContent}>
            {activeTab === 'payment' ? (
              <PaymentForm
                onSuccess={onSuccess}
                onClose={onClose}
                reportId={reportId}
                analysisId={analysisId}
                productName={productName}
                amount={amount}
              />
            ) : (
              user ? (
                <TransactionHistory userId={user.uid} />
              ) : (
                <div className={styles.errorMessage}>
                  Please log in to view transaction history
                </div>
              )
            )}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <p className={styles.footerText}>
            <LockIcon />
            Secure payment powered by Stripe
          </p>
        </div>
      </div>
    </div>
  )
}
