'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from './page.module.css'
import Header from '@/components/Header'
import { DownloadIcon } from '@/components/Icons'
import { useAuth } from '@/lib/auth'
import { analysisApi } from '@/lib/analysis-api'

interface Report {
  id: string
  productName: string
  intendedUse: string
  createdAt: string
  hazardCount: number
}

export default function ReportsPage() {
  const router = useRouter()
  const { user, loading: authLoading, isAnonymous } = useAuth()
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<Report[]>([])

  useEffect(() => {
    const fetchReportListData = async () => {
      if (!user || authLoading) {
        setLoading(false)
        return
      }
      
      setLoading(true)
      try {
        console.log('[Reports] Fetching report list...')
        const analyses = await analysisApi.fetchReportList()
        console.log('[Reports] Received analyses:', analyses)
        
        const formattedReports: Report[] = analyses.map((analysis: any) => ({
          id: analysis.analysis_id,
          productName: analysis.device_name || 'Unknown Device',
          intendedUse: analysis.intended_use || '',
          createdAt: analysis.completed_at ? new Date(analysis.completed_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          hazardCount: analysis.hazard_count || 0
        }))
        console.log('[Reports] Formatted reports:', formattedReports)
        setReports(formattedReports)
      } catch (error) {
        console.error('[Reports] Error fetching report list:', error)
        setReports([])
      } finally {
        setLoading(false)
      }
    }
    
    fetchReportListData()
  }, [user, authLoading])

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
      router.push(`/results?analysis_id=${encodeURIComponent(report.id)}&productName=${encodeURIComponent(report.productName)}&intendedUse=${encodeURIComponent(report.intendedUse)}`)
    }
  }

  return (
    <main className={styles.main}>
      <Header showAuthButtons={!user || isAnonymous} showUserMenu={!!(user && !isAnonymous)} />
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

