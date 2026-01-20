'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from './page.module.css'
import Header from '@/components/Header'
import { DownloadIcon } from '@/components/Icons'
import { useAuth } from '@/lib/auth'
import { Transaction } from '@/lib/types/stripe'
import ReceiptModal from '@/components/ReceiptModal'
import { trackEvent } from '@/lib/analytics'

export default function InvoicesPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
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
        
        const response = await fetch(`/api/payments/transactions?userId=${encodeURIComponent(user.uid)}`)

        if (!response.ok) {
          throw new Error('Failed to fetch transactions')
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

  const getStatusClass = (status: Transaction['status']) => {
    switch (status) {
      case 'succeeded':
        return styles.statusPaid
      case 'failed':
        return styles.statusOverdue
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

  const getStatusLabel = (status: Transaction['status']) => {
    return status.charAt(0).toUpperCase() + status.slice(1)
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
                      {transaction.description || `Payment ${transaction.id.slice(-8)}`}
                    </h3>
                    <p className={styles.invoiceDate}>{formatDate(transaction.createdAt)}</p>
                  </div>
                  <div className={styles.invoiceAmount}>
                    <span className={styles.amount}>{formatCurrency(transaction.amount, transaction.currency)}</span>
                    <span className={`${styles.status} ${getStatusClass(transaction.status)}`}>
                      {getStatusLabel(transaction.status)}
                    </span>
                  </div>
                </div>
                <div className={styles.invoiceBody}>
                  {transaction.productName && (
                    <p className={styles.invoiceReport}>
                      Report: <strong>{transaction.productName}</strong>
                    </p>
                  )}
                  <p className={styles.invoiceDescription}>
                    Payment ID: {transaction.paymentIntentId}
                  </p>
                </div>
                {transaction.status === 'succeeded' && (
                  <div className={styles.invoiceActions}>
                    <button
                      onClick={() => {
                        trackEvent('click_view_receipt', {
                          transaction_id: transaction.id,
                          payment_intent_id: transaction.paymentIntentId,
                          amount: transaction.amount,
                          product_name: transaction.productName || undefined
                        })
                        setSelectedTransaction(transaction)
                        setShowReceiptModal(true)
                      }}
                      className={styles.downloadButton}
                    >
                      <DownloadIcon />
                      View Receipt
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
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
                  {formatCurrency(transactions.filter(t => t.status === 'pending').reduce((sum, t) => sum + t.amount, 0))}
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

      {showReceiptModal && selectedTransaction && (
        <ReceiptModal
          isOpen={showReceiptModal}
          onClose={() => {
            trackEvent('close_receipt_modal', {
              transaction_id: selectedTransaction.id,
              payment_intent_id: selectedTransaction.paymentIntentId
            })
            setShowReceiptModal(false)
            setSelectedTransaction(null)
          }}
          transaction={selectedTransaction}
          purpose="download"
        />
      )}
    </main>
  )
}

