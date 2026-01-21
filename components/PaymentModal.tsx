'use client'

import { useState, useEffect, useRef } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import styles from './PaymentModal.module.css'
import { LockIcon, DownloadIcon } from './Icons'
import { useAuth } from '@/lib/auth'
import { Transaction } from '@/lib/types/stripe'
import ReceiptModal from './ReceiptModal'
import { trackEvent } from '@/lib/analytics'
import { getFirebaseAuth } from '@/lib/firebase'

// API URL for backend
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'

// Backend transaction type (matches backend API response)
interface BackendTransaction {
  id: string
  order_id: string
  amount: number
  currency: string
  status: 'pending' | 'succeeded' | 'failed' | 'canceled' | 'refunded' | 'requires_action' | 'processing'
  payment_intent_id: string | null
  charge_id: string | null
  payment_method_type: string | null
  card_brand: string | null
  card_last4: string | null
  receipt_url: string | null
  receipt_number: string | null
  created_at: string
  succeeded_at: string | null
  failed_at: string | null
  refunded_at: string | null
  failure_code: string | null
  failure_message: string | null
  refund_amount: number | null
  refund_reason: string | null
  product_type: string
  product_id: string
  product_name: string
  product_metadata: any
  coupon_code: string | null
  discount_amount: number
  original_amount: number
}

// Initialize Stripe (will be set dynamically from backend response)
let stripePromise: Promise<any> | null = null

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
  analysisId,
  productType = 'analysis',
  productId,
  productName, 
  amount = 5.00,
  finalAmount,
  clientSecret,
  onProcessingChange
}: {
  onSuccess: (paymentIntentId?: string) => void
  onClose: () => void
  reportId?: string
  analysisId?: string
  productType?: string
  productId?: string
  productName?: string
  amount?: number
  finalAmount?: number
  clientSecret: string
  onProcessingChange?: (isProcessing: boolean) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const { user } = useAuth()
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const shouldContinuePollingRef = useRef(true)

  // Notify parent when processing state changes
  useEffect(() => {
    if (onProcessingChange) {
      onProcessingChange(isProcessing || isPolling)
    }
  }, [isProcessing, isPolling, onProcessingChange])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      shouldContinuePollingRef.current = false
      setIsPolling(false)
    }
  }, [])

  // Poll backend to check payment status
  const pollPaymentStatus = async (paymentIntentId: string): Promise<boolean> => {
    if (!user) {
      console.error('[Payment] No user for polling')
      return false
    }
    
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'
    const prodId = productId || analysisId || reportId
    
    if (!prodId) {
      console.error('[Payment] No product ID available for polling')
      return false
    }
    
    setIsPolling(true)
    shouldContinuePollingRef.current = true
    console.log('[Payment] Starting payment status polling for product:', prodId)
    
    try {
      const token = await user.getIdToken()
      let attempts = 0
      const maxAttempts = 30 // Poll for up to 30 seconds
      
      while (shouldContinuePollingRef.current && attempts < maxAttempts) {
        try {
          const statusResponse = await fetch(
            `${apiUrl}/orders/${productType}/${prodId}/status`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            }
          )
          
          if (statusResponse.ok) {
            const statusData = await statusResponse.json()
            console.log(`[Payment] Status check attempt ${attempts + 1}:`, statusData.paid ? 'PAID' : 'NOT PAID')
            
            if (statusData.paid) {
              console.log('[Payment] Payment confirmed by backend!')
              setIsPolling(false)
              return true
            }
          } else {
            console.warn('[Payment] Status check failed:', statusResponse.status)
          }
        } catch (err) {
          console.error('[Payment] Error checking payment status:', err)
        }
        
        attempts++
        if (attempts < maxAttempts && shouldContinuePollingRef.current) {
          await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second
        }
      }
      
      console.log(`[Payment] Polling ended after ${attempts} attempts, cancelled: ${!shouldContinuePollingRef.current}`)
      setIsPolling(false)
      return false
    } catch (err) {
      console.error('[Payment] Polling error:', err)
      setIsPolling(false)
      return false
    }
  }

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

      console.log('[Payment] Payment succeeded, PaymentIntent ID:', paymentIntent.id)

      // Track payment success
      trackEvent('payment_success', {
        payment_intent_id: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        product_name: productName || undefined
      })

      // Poll backend to verify payment status before calling onSuccess
      console.log('[Payment] Waiting for backend confirmation...')
      const confirmed = await pollPaymentStatus(paymentIntent.id)
      
      if (confirmed) {
        console.log('[Payment] Payment confirmed by backend, calling onSuccess')
        onSuccess(paymentIntent.id)
      } else {
        // Payment succeeded in Stripe but not confirmed by backend
        const errorMsg = 'Payment processing is taking longer than expected. Please check your payment history or contact support.'
        setError(errorMsg)
        console.error('[Payment] Backend confirmation failed or timed out')
        
        // Track backend confirmation failure
        trackEvent('payment_backend_confirmation_failed', {
          payment_intent_id: paymentIntent.id,
          product_name: productName || undefined
        })
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Payment processing failed'
      setError(errorMessage)
      console.error('[Payment] Error:', err)
      
      // Track payment failure
      trackEvent('payment_failed', {
        error: errorMessage,
        product_name: productName || undefined
      })
    } finally {
      setIsProcessing(false)
      setIsPolling(false)
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
        disabled={isProcessing || isPolling || !stripe}
      >
        {(isProcessing || isPolling) ? 'Processing...' : `Pay $${(finalAmount || amount).toFixed(2)}`}
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
  const [couponCode, setCouponCode] = useState<string>('')
  const [discountInfo, setDiscountInfo] = useState<{ discount: number; finalAmount: number } | null>(null)

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
      // Get Firebase auth token
      const token = await user.getIdToken()
      
      console.log('[PaymentForm] Sending request to backend /orders/create')
      const response = await fetch(`${API_URL}/orders/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          product_type: 'analysis',
          product_id: analysisId || reportId,
          coupon_code: couponCode.trim() || null,
          product_metadata: {
            product_name: productName,
            report_id: reportId,
          },
        }),
      })

      console.log('[PaymentForm] Response status:', response.status)
      console.log('[PaymentForm] Response ok:', response.ok)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('[PaymentForm] Error response:', errorData)
        throw new Error(errorData.detail || 'Failed to create order')
      }

      const data = await response.json()
      console.log('[PaymentForm] Received data:', data)
      console.log('[PaymentForm] Client secret:', data.client_secret ? 'present' : 'missing')
      console.log('[PaymentForm] Final amount from backend:', data.amount)
      
      // Store discount info if coupon was applied
      if (data.amount !== undefined) {
        const originalAmount = amount
        const finalAmount = data.amount
        const discount = originalAmount - finalAmount
        
        // Update discount info even if discount is 0 (to show we checked)
        setDiscountInfo({ discount, finalAmount })
        
        if (discount > 0) {
          console.log('[PaymentForm] Coupon applied! Discount:', discount)
        }
      }
      
      // Initialize Stripe with publishable key from backend
      if (data.stripe_publishable_key) {
        stripePromise = loadStripe(data.stripe_publishable_key)
      }
      
      setClientSecret(data.client_secret)
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
        <div className={styles.couponSection}>
          <input
            id="coupon-code"
            type="text"
            className={styles.couponInput}
            placeholder="Enter coupon code (Optional)"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            disabled={isInitializing}
          />
          <p className={styles.couponHint}>
            Have a discount code? Enter it here before proceeding.
          </p>
        </div>
        
        {discountInfo && (
          <div className={styles.discountInfo}>
            <p className={styles.discountLabel}>✓ Coupon Applied!</p>
            <p className={styles.discountAmount}>
              Save ${discountInfo.discount.toFixed(2)} - New Total: ${discountInfo.finalAmount.toFixed(2)}
            </p>
          </div>
        )}
        
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
            discountInfo ? `Proceed to Payment - $${discountInfo.finalAmount.toFixed(2)}` : `Proceed to Payment - $${amount.toFixed(2)}`
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
  
  // Ensure stripePromise is initialized
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')
  }
  
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <PaymentFormInner
        onSuccess={onSuccess}
        onClose={onClose}
        reportId={reportId}
        analysisId={analysisId}
        productType="analysis"
        productId={analysisId || reportId}
        productName={productName}
        amount={amount}
        finalAmount={discountInfo?.finalAmount}
        clientSecret={clientSecret}
        onProcessingChange={onProcessingChange}
      />
    </Elements>
  )
}

// Transaction history component
function TransactionHistory({ userId, purpose }: { userId: string; purpose?: PaymentPurpose }) {
  const [transactions, setTransactions] = useState<BackendTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<BackendTransaction | null>(null)
  const [showReceiptModal, setShowReceiptModal] = useState(false)

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Get Firebase auth token
        const auth = getFirebaseAuth()
        const currentUser = auth.currentUser
        if (!currentUser) {
          throw new Error('Not authenticated')
        }
        
        const token = await currentUser.getIdToken()
        
        // Call backend API
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const response = await fetch(`${apiUrl}/orders/transactions?limit=50&offset=0`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.detail || 'Failed to fetch transactions')
        }

        const data = await response.json()
        setTransactions(data.transactions || [])
        console.log('[Transactions] Loaded transactions:', data.transactions?.length || 0)
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

  const getStatusClass = (status: BackendTransaction['status']) => {
    switch (status) {
      case 'succeeded':
        return styles.statusSuccess
      case 'failed':
        return styles.statusFailed
      case 'refunded':
        return styles.statusRefunded
      case 'pending':
      case 'requires_action':
      case 'processing':
        return styles.statusPending
      case 'canceled':
        return styles.statusCanceled
      default:
        return ''
    }
  }

  const getStatusLabel = (status: BackendTransaction['status']) => {
    const labels: Record<string, string> = {
      'succeeded': 'Paid',
      'pending': 'Pending',
      'requires_action': 'Action Required',
      'processing': 'Processing',
      'failed': 'Failed',
      'canceled': 'Canceled',
      'refunded': 'Refunded'
    }
    return labels[status] || status.charAt(0).toUpperCase() + status.slice(1)
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
                {transaction.product_name || `Payment ${transaction.id.slice(-8)}`}
              </h4>
              <p className={styles.transactionDate}>{formatDate(transaction.created_at)}</p>
            </div>
            <div className={styles.transactionAmount}>
              <span className={styles.amount}>{formatCurrency(transaction.amount, transaction.currency)}</span>
              <span className={`${styles.status} ${getStatusClass(transaction.status)}`}>
                {getStatusLabel(transaction.status)}
              </span>
            </div>
          </div>
          
          <div className={styles.transactionBody}>
            {transaction.product_name && (
              <p className={styles.transactionProduct}>
                Product: <strong>{transaction.product_name}</strong>
              </p>
            )}
            {transaction.coupon_code && (
              <p className={styles.transactionProduct}>
                Coupon: <strong>{transaction.coupon_code}</strong> 
                {transaction.discount_amount > 0 && (
                  <span> (Saved {formatCurrency(transaction.discount_amount, transaction.currency)})</span>
                )}
              </p>
            )}
            {transaction.payment_method_type && (
              <p className={styles.transactionDescription}>
                Payment Method: {transaction.card_brand ? transaction.card_brand.toUpperCase() : transaction.payment_method_type.toUpperCase()}
                {transaction.card_last4 && ` •••• ${transaction.card_last4}`}
              </p>
            )}
            <p className={styles.transactionDescription}>
              Payment ID: {transaction.payment_intent_id || transaction.id}
            </p>
            {transaction.receipt_number && (
              <p className={styles.transactionDescription}>
                Receipt: {transaction.receipt_number}
              </p>
            )}
          </div>

          {transaction.status === 'succeeded' && (
            <div className={styles.transactionActions}>
              <button
                onClick={() => {
                  setSelectedTransaction(transaction)
                  setShowReceiptModal(true)
                  trackEvent('view_transaction_details', {
                    transaction_id: transaction.id,
                    payment_intent_id: transaction.payment_intent_id,
                    amount: transaction.amount,
                    product_name: transaction.product_name || undefined
                  })
                }}
                className={styles.receiptButton}
              >
                View Details
              </button>
            
            </div>
          )}
        </div>
      ))}
      
      {showReceiptModal && selectedTransaction && (
        <ReceiptModal
          isOpen={showReceiptModal}
          onClose={() => {
            setShowReceiptModal(false)
            setSelectedTransaction(null)
          }}
          transaction={{
            id: selectedTransaction.id,
            description: selectedTransaction.product_name || `Payment ${selectedTransaction.id.slice(-8)}`,
            amount: selectedTransaction.amount,
            currency: selectedTransaction.currency,
            status: selectedTransaction.status as any,
            createdAt: selectedTransaction.created_at,
            productName: selectedTransaction.product_name,
            paymentIntentId: selectedTransaction.payment_intent_id || '',
            receiptUrl: selectedTransaction.receipt_url || null,
            receiptNumber: selectedTransaction.receipt_number || undefined,
            paymentMethod: selectedTransaction.payment_method_type ? {
              type: selectedTransaction.payment_method_type,
              card: selectedTransaction.card_brand && selectedTransaction.card_last4 ? {
                brand: selectedTransaction.card_brand,
                last4: selectedTransaction.card_last4
              } : undefined
            } : undefined
          }}
          purpose={purpose}
        />
      )}
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

  // Track modal open on mount
  useEffect(() => {
    trackEvent('open_payment_modal', {
      purpose,
      analysis_id: analysisId || undefined,
      product_name: productName || undefined,
      amount
    })
  }, [])

  // Handle modal close - PaymentForm will handle canceling PaymentIntent if needed
  const handleClose = () => {
    // Prevent closing if payment is processing
    if (isPaymentProcessing) {
      return
    }
    
    // Track modal close
    trackEvent('close_payment_modal', {
      purpose,
      analysis_id: analysisId || undefined,
      product_name: productName || undefined
    })
    
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
            {purpose === 'generation' ? 'Generate Analysis' : 'Generate Full Report'}
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
                onProcessingChange={setIsPaymentProcessing}
              />
            ) : (
              user ? (
                <TransactionHistory userId={user.uid} purpose={purpose} />
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
