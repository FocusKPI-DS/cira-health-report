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
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [couponValidated, setCouponValidated] = useState(false)

  // Validate coupon code
  const handleValidateCoupon = async () => {
    if (!user) {
      setCouponError('Please log in to validate coupon')
      return
    }

    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code')
      return
    }

    setIsValidatingCoupon(true)
    setCouponError(null)
    setDiscountInfo(null)
    setCouponValidated(false)
    console.log('[Coupon] Validating coupon:', couponCode)

    try {
      const token = await user.getIdToken()
      
      const response = await fetch(`${API_URL}/orders/validate-coupon`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          coupon_code: couponCode.trim(),
        }),
      })

      const data = await response.json()
      console.log('[Coupon] Validation response:', data)

      if (data.success && data.valid) {
        const discount = data.discount_amount
        const finalAmount = data.final_amount
        
        setDiscountInfo({ discount, finalAmount })
        setCouponValidated(true)
        
        // Track successful coupon validation
        trackEvent('coupon_validated_success', {
          coupon_code: couponCode,
          discount_amount: discount,
          final_amount: finalAmount,
          discount_type: data.discount_type,
          analysis_id: analysisId || reportId || undefined
        })
      } else {
        setCouponError(data.message || 'Invalid coupon code')
        setCouponValidated(false)
        
        // Track failed coupon validation
        trackEvent('coupon_validated_failed', {
          coupon_code: couponCode,
          error: data.message,
          analysis_id: analysisId || reportId || undefined
        })
      }
    } catch (err: any) {
      console.error('[Coupon] Error validating coupon:', err)
      setCouponError(err.message || 'Failed to validate coupon')
      setCouponValidated(false)
      
      // Track coupon validation error
      trackEvent('coupon_validation_error', {
        coupon_code: couponCode,
        error: err.message,
        analysis_id: analysisId || reportId || undefined
      })
    } finally {
      setIsValidatingCoupon(false)
    }
  }

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
      console.log('[PaymentForm] Order status:', data.status)
      
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
      
      // Special case: If amount is $0 (100% discount), order is already completed
      if (data.amount === 0 || data.status === 'completed') {
        console.log('[PaymentForm] Order completed with 100% discount - no payment required')
        
        // Track free order success
        trackEvent('free_order_success', {
          order_id: data.order_id,
          coupon_code: couponCode || undefined,
          analysis_id: analysisId || reportId || undefined,
          product_name: productName || undefined
        })
        
        // Call onSuccess directly (no payment needed)
        onSuccess(data.order_id)
        return
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
          <div className={styles.couponInputGroup}>
            <input
              id="coupon-code"
              type="text"
              className={styles.couponInput}
              placeholder="Enter coupon code (Optional)"
              value={couponCode}
              onChange={(e) => {
                const newCode = e.target.value.toUpperCase()
                setCouponCode(newCode)
                // Reset validation state when code changes
                setCouponValidated(false)
                setCouponError(null)
                setDiscountInfo(null)
                if (newCode.length >= 3) {
                  trackEvent('enter_coupon_code', {
                    analysis_id: analysisId || reportId || undefined
                  })
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isValidatingCoupon && couponCode.trim() && !isInitializing) {
                  handleValidateCoupon()
                }
              }}
              disabled={isInitializing || isValidatingCoupon}
            />
            <button
              type="button"
              className={styles.validateButton}
              onClick={handleValidateCoupon}
              disabled={isValidatingCoupon || !couponCode.trim() || isInitializing}
            >
              {isValidatingCoupon ? 'Validating...' : 'Validate'}
            </button>
          </div>
          
          {couponError && (
            <p className={styles.couponError}>
              ✗ {couponError}
            </p>
          )}
          
          {couponValidated && discountInfo && (
            <div className={styles.couponSuccess}>
              <p className={styles.couponSuccessText}>
                ✓ Coupon applied! Save ${discountInfo.discount.toFixed(2)}
              </p>
              <p className={styles.couponNewPrice}>
                New Price: ${discountInfo.finalAmount.toFixed(2)}
              </p>
            </div>
          )}
          

        </div>
        
        <p className={styles.initText}>
          Click the button below to proceed with payment
        </p>
        
        <button
          type="button"
          className={styles.initButton}
          onClick={() => {
            trackEvent('click_proceed_to_payment', {
              has_coupon: !!couponCode,
              coupon_validated: couponValidated,
              analysis_id: analysisId || reportId || undefined
            })
            handleInitializePayment()
          }}
          disabled={isInitializing || !user}
        >
          {isInitializing ? (
            <>
              <div className={styles.spinner}></div>
              Initializing payment...
            </>
          ) : (
            discountInfo && couponValidated
              ? `Proceed to Payment - $${discountInfo.finalAmount.toFixed(2)}`
              : `Proceed to Payment - $${amount.toFixed(2)}`
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
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  const [pageInput, setPageInput] = useState('1')

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
        // Call backend API with pagination
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
        const offset = (currentPage - 1) * pageSize
        const response = await fetch(`${apiUrl}/orders/transactions?limit=${pageSize}&offset=${offset}`, {
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
        setTotalCount(data.total_count || 0)
        // Optionally: set statistics if needed
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
  }, [userId, currentPage, pageSize])

  // Sync pageInput with currentPage when currentPage changes
  useEffect(() => {
    setPageInput(currentPage.toString())
  }, [currentPage])

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
  const totalPages = Math.ceil(totalCount / pageSize)
  return (
    <div>
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
      {/* Pagination Controls */}
      {!loading && transactions.length > 0 && (
        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 6px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid rgba(14, 165, 233, 0.2)', flexWrap: 'nowrap', gap: '4px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: '0 0 auto' }}>
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              style={{
                padding: '2px 6px',
                backgroundColor: currentPage === 1 ? '#e2e8f0' : 'linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)',
                background: currentPage === 1 ? '#e2e8f0' : 'linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)',
                color: currentPage === 1 ? '#94a3b8' : 'white',
                border: 'none',
                borderRadius: '5px',
                fontSize: '11px',
                fontWeight: '500',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                whiteSpace: 'nowrap',
                minWidth: '40px'
              }}
            >
              ⟨⟨
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              style={{
                padding: '2px 6px',
                backgroundColor: currentPage === 1 ? '#e2e8f0' : 'linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)',
                background: currentPage === 1 ? '#e2e8f0' : 'linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)',
                color: currentPage === 1 ? '#94a3b8' : 'white',
                border: 'none',
                borderRadius: '5px',
                fontSize: '11px',
                fontWeight: '500',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                whiteSpace: 'nowrap',
                minWidth: '40px'
              }}
            >
              ←
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: '0 1 auto', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ fontSize: '11px', fontWeight: '500', color: '#1e293b', whiteSpace: 'nowrap' }}>
                Page
              </span>
              <input
                type="number"
                min="1"
                max={totalPages}
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const page = Number(pageInput)
                    if (page >= 1 && page <= totalPages) {
                      setCurrentPage(page)
                    } else if (page < 1) {
                      setCurrentPage(1)
                      setPageInput('1')
                    } else if (page > totalPages) {
                      setCurrentPage(totalPages)
                      setPageInput(totalPages.toString())
                    }
                  }
                }}
                style={{
                  width: '36px',
                  padding: '2px 3px',
                  border: '1px solid rgba(14, 165, 233, 0.2)',
                  borderRadius: '5px',
                  fontSize: '11px',
                  textAlign: 'center'
                }}
              />
              <span style={{ fontSize: '11px', fontWeight: '500', color: '#1e293b', whiteSpace: 'nowrap' }}>
                / {totalPages}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <label style={{ fontSize: '11px', fontWeight: '500', color: '#1e293b', whiteSpace: 'nowrap' }}>
                Per page:
              </label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setCurrentPage(1)
                }}
                style={{
                  padding: '2px 3px',
                  border: '1px solid rgba(14, 165, 233, 0.2)',
                  borderRadius: '5px',
                  fontSize: '11px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  minWidth: '40px'
                }}
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: '0 0 auto' }}>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages}
              style={{
                padding: '2px 6px',
                backgroundColor: currentPage >= totalPages ? '#e2e8f0' : 'linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)',
                background: currentPage >= totalPages ? '#e2e8f0' : 'linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)',
                color: currentPage >= totalPages ? '#94a3b8' : 'white',
                border: 'none',
                borderRadius: '5px',
                fontSize: '11px',
                fontWeight: '500',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                whiteSpace: 'nowrap',
                minWidth: '40px'
              }}
            >
              →
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage >= totalPages}
              style={{
                padding: '2px 6px',
                backgroundColor: currentPage >= totalPages ? '#e2e8f0' : 'linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)',
                background: currentPage >= totalPages ? '#e2e8f0' : 'linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)',
                color: currentPage >= totalPages ? '#94a3b8' : 'white',
                border: 'none',
                borderRadius: '5px',
                fontSize: '11px',
                fontWeight: '500',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                whiteSpace: 'nowrap',
                minWidth: '40px'
              }}
            >
              ⟩⟩
            </button>
          </div>
        </div>
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
          {/* Tabs */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'payment' ? styles.tabActive : ''}`}
              onClick={() => {
                trackEvent('switch_payment_tab', {
                  tab: 'payment',
                  analysis_id: analysisId || undefined
                })
                setActiveTab('payment')
              }}
            >
              Payment
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'history' ? styles.tabActive : ''}`}
              onClick={() => {
                trackEvent('switch_payment_tab', {
                  tab: 'history',
                  analysis_id: analysisId || undefined
                })
                setActiveTab('history')
              }}
            >
              Transaction History
            </button>
          </div>

          {/* Tab Content */}
          <div className={styles.tabContent}>
            {activeTab === 'payment' ? (
              <>
                <div className={styles.priceSection}>
                  <div className={styles.priceLabel}>Total</div>
                  <div className={styles.priceAmount}>${amount.toFixed(2)}</div>
                </div>
                <PaymentForm
                onSuccess={onSuccess}
                onClose={onClose}
                reportId={reportId}
                analysisId={analysisId}
                productName={productName}
                amount={amount}
                onProcessingChange={setIsPaymentProcessing}
              />
              </>
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
