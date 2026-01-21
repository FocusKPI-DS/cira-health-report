'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from './page.module.css'
import Header from '@/components/Header'
import { DownloadIcon } from '@/components/Icons'
import { useAuth } from '@/lib/auth'
import { getFirebaseAuth } from '@/lib/firebase'
import ReceiptModal from '@/components/ReceiptModal'
import { trackEvent } from '@/lib/analytics'

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

export default function InvoicesPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [transactions, setTransactions] = useState<BackendTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<BackendTransaction | null>(null)
  const [showReceiptModal, setShowReceiptModal] = useState(false)

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!user) {
        setLoading(false)
        return
      }

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
      } catch (err: any) {
        setError(err.message || 'Failed to load transactions')
        console.error('[Invoices] Error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchTransactions()
  }, [user])

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

  const formatCurrency = (amount: number, currency: string = 'usd') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount)
  }

  const getStatusClass = (status: BackendTransaction['status']) => {
    switch (status) {
      case 'succeeded':
        return styles.statusPaid
      case 'failed':
        return styles.statusOverdue
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

  return (
    <main className={styles.main} style={{ flex: 1 }}>
      <Header showUserMenu={true} />
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Invoices & Payment Statements</h1>
            <p className={styles.subtitle}>
              View and download your invoices and payment history
            </p>
          </div>
        </div>

        {!user ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>Please log in to view invoices</p>
          </div>
        ) : loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>Loading transactions...</p>
          </div>
        ) : error ? (
          <div className={styles.errorMessage}>
            {error}
          </div>
        ) : transactions.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>No transactions yet</p>
            <p className={styles.emptySubtext}>
              Your payment history will appear here after you make purchases
            </p>
          </div>
        ) : (
          <div className={styles.invoicesList}>
            {transactions.map((transaction) => (
              <div key={transaction.id} className={styles.invoiceCard}>
                <div className={styles.invoiceHeader}>
                  <div className={styles.invoiceInfo}>
                    <h3 className={styles.invoiceNumber}>
                      {transaction.product_name || `Payment ${transaction.id.slice(-8)}`}
                    </h3>
                    <p className={styles.invoiceDate}>{formatDate(transaction.created_at)}</p>
                  </div>
                  <div className={styles.invoiceAmount}>
                    <span className={styles.amount}>{formatCurrency(transaction.amount, transaction.currency)}</span>
                    <span className={`${styles.status} ${getStatusClass(transaction.status)}`}>
                      {getStatusLabel(transaction.status)}
                    </span>
                  </div>
                </div>
                <div className={styles.invoiceBody}>
                  {transaction.product_name && (
                    <p className={styles.invoiceReport}>
                      Product: <strong>{transaction.product_name}</strong>
                    </p>
                  )}
                  {transaction.coupon_code && (
                    <p className={styles.invoiceReport}>
                      Coupon: <strong>{transaction.coupon_code}</strong> 
                      {transaction.discount_amount > 0 && (
                        <span> (Saved {formatCurrency(transaction.discount_amount, transaction.currency)})</span>
                      )}
                    </p>
                  )}
                  {transaction.payment_method_type && (
                    <p className={styles.invoiceDescription}>
                      Payment Method: {transaction.card_brand ? transaction.card_brand.toUpperCase() : transaction.payment_method_type.toUpperCase()}
                      {transaction.card_last4 && ` •••• ${transaction.card_last4}`}
                    </p>
                  )}
                  <p className={styles.invoiceDescription}>
                    Payment ID: {transaction.payment_intent_id || transaction.id}
                  </p>
                  {transaction.receipt_number && (
                    <p className={styles.invoiceDescription}>
                      Receipt: {transaction.receipt_number}
                    </p>
                  )}
                </div>
                {transaction.status === 'succeeded' && (
                  <div className={styles.invoiceActions}>
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
                      className={styles.viewButton}
                    >
                      View Details
                    </button>
                    {transaction.receipt_url && (
                      <a
                        href={transaction.receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          trackEvent('click_stripe_receipt', {
                            transaction_id: transaction.id,
                            payment_intent_id: transaction.payment_intent_id,
                            amount: transaction.amount,
                            product_name: transaction.product_name || undefined
                          })
                        }}
                        className={styles.downloadButton}
                      >
                        <DownloadIcon />
                        View Stripe Receipt
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {showReceiptModal && selectedTransaction && (
          <ReceiptModal
            isOpen={showReceiptModal}
            onClose={() => {
              setShowReceiptModal(false)
              setSelectedTransaction(null)
            }}
            transaction={{
              id: selectedTransaction.id,
              paymentIntentId: selectedTransaction.payment_intent_id || selectedTransaction.id,
              description: selectedTransaction.product_name || `Payment ${selectedTransaction.id.slice(-8)}`,
              amount: selectedTransaction.amount,
              currency: selectedTransaction.currency,
              status: selectedTransaction.status as any,
              createdAt: selectedTransaction.created_at,
              productName: selectedTransaction.product_name,
              paymentMethod: selectedTransaction.payment_method_type ? {
                type: selectedTransaction.payment_method_type,
                ...(selectedTransaction.card_brand && selectedTransaction.card_last4 ? {
                  card: {
                    brand: selectedTransaction.card_brand,
                    last4: selectedTransaction.card_last4
                  }
                } : {})
              } : undefined,
              receiptUrl: selectedTransaction.receipt_url || null,
              receiptNumber: selectedTransaction.receipt_number || undefined
            }}
            purpose="download"
          />
        )}

        <div className={styles.summarySection}>
          <div className={styles.summaryCard}>
            <h3 className={styles.summaryTitle}>Payment Summary</h3>
            <div className={styles.summaryStats}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Total Paid</span>
                <span className={styles.statValue}>
                  {formatCurrency(transactions.filter(t => t.status === 'succeeded').reduce((sum, t) => sum + t.amount, 0))}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Pending</span>
                <span className={styles.statValue}>
                  {formatCurrency(transactions.filter(t => ['pending', 'processing', 'requires_action'].includes(t.status)).reduce((sum, t) => sum + t.amount, 0))}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Total Transactions</span>
                <span className={styles.statValue}>{transactions.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

