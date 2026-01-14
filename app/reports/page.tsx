'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from './page.module.css'
import Header from '@/components/Header'
import { DownloadIcon } from '@/components/Icons'

interface Report {
  id: string
  productName: string
  intendedUse: string
  createdAt: string
  hazardCount: number
}

export default function ReportsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<Report[]>([
    {
      id: '1',
      productName: 'Syringe',
      intendedUse: 'Medical device for injection of medications',
      createdAt: '2024-01-15',
      hazardCount: 8
    },
    {
      id: '2',
      productName: 'Blood Pressure Monitor',
      intendedUse: 'Device for measuring and monitoring blood pressure',
      createdAt: '2024-01-10',
      hazardCount: 12
    },
    {
      id: '3',
      productName: 'Pacemaker',
      intendedUse: 'Implantable device for regulating heart rhythm',
      createdAt: '2024-01-05',
      hazardCount: 15
    },
    {
      id: '4',
      productName: 'X-Ray Machine',
      intendedUse: 'Medical imaging device for diagnostic purposes',
      createdAt: '2023-12-28',
      hazardCount: 20
    }
  ])

  useEffect(() => {
    // Simulate API call
    const loadReports = async () => {
      setLoading(true)
      await new Promise(resolve => setTimeout(resolve, 600))
      setLoading(false)
    }
    loadReports()
  }, [])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  const handleViewReport = (reportId: string) => {
    const report = reports.find(r => r.id === reportId)
    if (report) {
      router.push(`/results?productName=${encodeURIComponent(report.productName)}&intendedUse=${encodeURIComponent(report.intendedUse)}&loggedIn=true`)
    }
  }

  return (
    <main className={styles.main}>
      <Header showUserMenu={true} />
      <div className={styles.container}>
        <div className={styles.contentCard}>
          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>Report History</h1>
              <p className={styles.subtitle}>
                Review and manage your past PHA analysis report history
              </p>
            </div>
            <Link href="/generate" className={styles.primaryButton}>
              Generate New Report
            </Link>
          </div>

          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner}></div>
              <p>Loading reports...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyText}>No reports yet</p>
              <Link href="/generate" className={styles.createButton}>
                Create Your First Report
              </Link>
            </div>
          ) : (
            <div className={styles.reportsList}>
              {reports.map((report) => (
                <div key={report.id} className={styles.reportCard}>
                  <div className={styles.reportContent}>
                    <h3 className={styles.reportTitle}>{report.productName}</h3>
                    <p className={styles.reportDescription}>{report.intendedUse}</p>
                    <div className={styles.reportMeta}>
                      <span className={styles.metaItem}>
                        {report.hazardCount} Hazards Identified
                      </span>
                      <span className={styles.reportDate}>{formatDate(report.createdAt)}</span>
                    </div>
                  </div>
                  <div className={styles.reportActions}>
                    <button 
                      className={styles.viewButton}
                      onClick={() => handleViewReport(report.id)}
                    >
                      View Report
                    </button>
                    <button className={styles.downloadButton}>
                      <DownloadIcon />
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

