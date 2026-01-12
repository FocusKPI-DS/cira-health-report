'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from './page.module.css'
import UserMenu from '@/components/UserMenu'
import { DownloadIcon } from '@/components/Icons'

interface Invoice {
  id: string
  invoiceNumber: string
  date: string
  amount: number
  status: 'paid' | 'pending' | 'overdue'
  description: string
  reportId?: string
  reportName?: string
}

export default function InvoicesPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate API call
    const loadInvoices = async () => {
      setLoading(true)
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Mock invoice data
      setInvoices([
        {
          id: '1',
          invoiceNumber: 'INV-2024-001',
          date: '2024-01-15',
          amount: 4.99,
          status: 'paid',
          description: 'Full Report Download - Syringe',
          reportId: '1',
          reportName: 'Syringe'
        },
        {
          id: '2',
          invoiceNumber: 'INV-2024-002',
          date: '2024-01-10',
          amount: 4.99,
          status: 'paid',
          description: 'Full Report Download - Blood Pressure Monitor',
          reportId: '2',
          reportName: 'Blood Pressure Monitor'
        },
        {
          id: '3',
          invoiceNumber: 'INV-2024-003',
          date: '2024-01-05',
          amount: 4.99,
          status: 'pending',
          description: 'Full Report Download - Pacemaker',
          reportId: '3',
          reportName: 'Pacemaker'
        }
      ])
      
      setLoading(false)
    }

    loadInvoices()
  }, [])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'paid':
        return styles.statusPaid
      case 'pending':
        return styles.statusPending
      case 'overdue':
        return styles.statusOverdue
      default:
        return ''
    }
  }

  const handleDownloadInvoice = (invoiceId: string) => {
    // In production, this would download the actual invoice PDF
    alert(`Downloading invoice ${invoiceId}...`)
  }

  return (
    <main className={styles.main}>
      <div className={styles.navbar}>
        <div className={styles.navContainer}>
          <Link href="/" className={styles.logo}>Cira Health</Link>
          <div className={styles.navActions}>
            <UserMenu />
          </div>
        </div>
      </div>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Invoices & Payment Statements</h1>
            <p className={styles.subtitle}>
              View and download your invoices and payment history
            </p>
          </div>
        </div>

        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>Loading invoices...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>No invoices yet</p>
            <p className={styles.emptySubtext}>
              Invoices will appear here after you download reports
            </p>
          </div>
        ) : (
          <div className={styles.invoicesList}>
            {invoices.map((invoice) => (
              <div key={invoice.id} className={styles.invoiceCard}>
                <div className={styles.invoiceHeader}>
                  <div className={styles.invoiceInfo}>
                    <h3 className={styles.invoiceNumber}>{invoice.invoiceNumber}</h3>
                    <p className={styles.invoiceDate}>{formatDate(invoice.date)}</p>
                  </div>
                  <div className={styles.invoiceAmount}>
                    <span className={styles.amount}>{formatCurrency(invoice.amount)}</span>
                    <span className={`${styles.status} ${getStatusClass(invoice.status)}`}>
                      {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                    </span>
                  </div>
                </div>
                <div className={styles.invoiceBody}>
                  <p className={styles.invoiceDescription}>{invoice.description}</p>
                  {invoice.reportName && (
                    <p className={styles.invoiceReport}>
                      Report: <strong>{invoice.reportName}</strong>
                    </p>
                  )}
                </div>
                <div className={styles.invoiceActions}>
                  <button 
                    className={styles.downloadButton}
                    onClick={() => handleDownloadInvoice(invoice.id)}
                  >
                    <DownloadIcon />
                    Download Invoice
                  </button>
                </div>
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
                  {formatCurrency(invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0))}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Pending</span>
                <span className={styles.statValue}>
                  {formatCurrency(invoices.filter(i => i.status === 'pending').reduce((sum, i) => sum + i.amount, 0))}
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Total Invoices</span>
                <span className={styles.statValue}>{invoices.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

