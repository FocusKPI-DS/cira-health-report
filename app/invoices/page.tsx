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
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalCount, setTotalCount] = useState(0)
  const [pageInput, setPageInput] = useState('1')
  
  // Statistics from backend
  const [statistics, setStatistics] = useState<{
    total_paid: number
    total_pending: number
    total_transactions: number
  } | null>(null)

  // Get auth state
  const { loading: authLoading, isAnonymous } = useAuth()

  // Authentication check - redirect if anonymous
  useEffect(() => {
    if (!authLoading && isAnonymous) {
      alert('Please log in to access the Invoices page')
      router.push('/')
    }
  }, [authLoading, isAnonymous, router])

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
        setStatistics(data.statistics || null)
      } catch (err: any) {
        setError(err.message || 'Failed to load transactions')
        console.error('[Invoices] Error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchTransactions()
  }, [user, currentPage, pageSize])

  // Sync pageInput with currentPage when currentPage changes
  useEffect(() => {
    setPageInput(currentPage.toString())
  }, [currentPage])

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

  const totalPages = Math.ceil(totalCount / pageSize)

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
                <div className={styles.invoiceRow}>
                  {/* 左侧信息栏 */}
                  <div className={styles.invoiceLeft}>
                    <h3 className={styles.invoiceProductName}>
                      {transaction.product_name || `Payment ${transaction.id.slice(-8)}`}
                    </h3>
                    <span className={styles.invoiceDate}>{formatDate(transaction.created_at)}</span>
                    {transaction.coupon_code && (
                      <span className={styles.invoiceReport}>
                        Coupon: <strong>{transaction.coupon_code}</strong>
                        {transaction.discount_amount > 0 && (
                          <span> (Saved {formatCurrency(transaction.discount_amount, transaction.currency)})</span>
                        )}
                      </span>
                    )}
                    {transaction.payment_method_type && (
                      <span className={styles.invoiceDescription}>
                        Payment Method: {transaction.card_brand ? transaction.card_brand.toUpperCase() : transaction.payment_method_type.toUpperCase()}
                        {transaction.card_last4 && ` •••• ${transaction.card_last4}`}
                      </span>
                    )}
                  </div>
                  {/* 右侧金额/状态/按钮栏 */}
                  <div className={styles.invoiceRight}>
                    <div className={styles.invoiceAmount}>
                      <span className={styles.amount}>{formatCurrency(transaction.amount, transaction.currency)}</span>
                      <span className={`${styles.status} ${getStatusClass(transaction.status)}`}>
                        {getStatusLabel(transaction.status)}
                      </span>
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
                        
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && transactions.length > 0 && (
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid rgba(14, 165, 233, 0.2)', flexWrap: 'nowrap', gap: '8px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '0 0 auto' }}>
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                style={{
                  padding: '6px 10px',
                  backgroundColor: currentPage === 1 ? '#e2e8f0' : 'linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)',
                  background: currentPage === 1 ? '#e2e8f0' : 'linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)',
                  color: currentPage === 1 ? '#94a3b8' : 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                ⟨⟨ First
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: '6px 10px',
                  backgroundColor: currentPage === 1 ? '#e2e8f0' : 'linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)',
                  background: currentPage === 1 ? '#e2e8f0' : 'linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)',
                  color: currentPage === 1 ? '#94a3b8' : 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                ← Prev
              </button>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 1 auto', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: '500', color: '#1e293b', whiteSpace: 'nowrap' }}>
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
                    width: '50px',
                    padding: '4px 6px',
                    border: '1px solid rgba(14, 165, 233, 0.2)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    textAlign: 'center'
                  }}
                />
                <span style={{ fontSize: '13px', fontWeight: '500', color: '#1e293b', whiteSpace: 'nowrap' }}>
                  / {totalPages}
                </span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500', color: '#1e293b', whiteSpace: 'nowrap' }}>
                  Per page:
                </label>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setCurrentPage(1)
                  }}
                  style={{
                    padding: '4px 6px',
                    border: '1px solid rgba(14, 165, 233, 0.2)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    backgroundColor: 'white',
                    cursor: 'pointer'
                  }}
                >
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                </select>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '0 0 auto' }}>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
                style={{
                  padding: '6px 10px',
                  backgroundColor: currentPage >= totalPages ? '#e2e8f0' : 'linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)',
                  background: currentPage >= totalPages ? '#e2e8f0' : 'linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)',
                  color: currentPage >= totalPages ? '#94a3b8' : 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                Next →
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages}
                style={{
                  padding: '6px 10px',
                  backgroundColor: currentPage >= totalPages ? '#e2e8f0' : 'linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)',
                  background: currentPage >= totalPages ? '#e2e8f0' : 'linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)',
                  color: currentPage >= totalPages ? '#94a3b8' : 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                Last ⟩⟩
              </button>
            </div>
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
                  {statistics ? formatCurrency(statistics.total_paid) : '$0.00'}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Pending</span>
                <span className={styles.statValue}>
                  {statistics ? formatCurrency(statistics.total_pending) : '$0.00'}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Total Transactions</span>
                <span className={styles.statValue}>{statistics ? statistics.total_transactions : 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

