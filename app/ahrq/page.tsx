"use client"
import React, { useEffect, useState } from 'react'
import Header from '../../components/Header'
import styles from '../downloads/page.module.css'

type Package = any

export default function AhrqPage() {
  const [q, setQ] = useState('')
  const [count, setCount] = useState(5)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<{ results?: Package[]; count?: number }>({})
  const [selectedPkg, setSelectedPkg] = useState<any | null>(null)
  const [page, setPage] = useState(1)

  async function doSearch(qs = q, org?: string) {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (qs !== undefined) params.set('q', qs)
      if (org) params.set('org', org)
      params.set('count', String(count))
      const start = (page - 1) * count
      params.set('start', String(start))

      const res = await fetch(`/api/ahrq/search?${params.toString()}`)
      const json = await res.json()
      setData({ results: json.results || [], count: json.count || 0 })
    } catch (e) {
      setData({ results: [] })
    } finally {
      setLoading(false)
    }
  }

  async function viewPackage(id: string) {
    setSelectedPkg({ loading: true })
    try {
      const res = await fetch(`/api/ahrq/search?id=${encodeURIComponent(id)}`)
      const json = await res.json()
      // package_show returns result as object
      setSelectedPkg(json.result || json)
    } catch (e) {
      setSelectedPkg({ error: String(e) })
    }
  }

  useEffect(() => {
    // Auto-run a default query for AHRQ (keyword search), show top `count` datasets
    doSearch('ahrq')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // re-run when page changes
    doSearch(q || 'ahrq')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  function exportCSV() {
    const rows: string[] = []
    const cols: string[] = ['id','title','organization','num_resources','num_tags']
    rows.push(cols.join(','));
    (data.results || []).forEach((r: any) => {
      const values: string[] = [
        JSON.stringify(r.id || ''),
        JSON.stringify(r.title || r.name || ''),
        JSON.stringify(r.organization?.title || r.owner_org || ''),
        JSON.stringify(r.num_resources || ''),
        JSON.stringify(r.num_tags || ''),
      ]
      rows.push(values.join(','))
    })
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ahrq-datasets-page-${page}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className={styles.container}>
      <Header />
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>AHRQ datasets (data.gov)</h1>
          <div>
            <button className={styles.refreshButton} onClick={() => exportCSV()} disabled={loading}>
              Export CSV
            </button>
            <button className={styles.refreshButton} style={{ marginLeft: 8 }} onClick={() => doSearch(q || 'ahrq')}>
              Refresh
            </button>
          </div>
        </div>

        <div className={styles.searchRow}>
          <input
            className={styles.searchInput}
            placeholder="search within AHRQ datasets"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className={styles.button} onClick={() => doSearch()} disabled={loading}>
            {loading ? 'Searching…' : 'Search AHRQ'}
          </button>
          <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
          </select>
        </div>

        <div style={{ marginTop: 12 }}>
          <strong>Quick examples: </strong>
          <button className={styles.smallButton} onClick={() => doSearch('HCUP')}>
            HCUP
          </button>
          <button className={styles.smallButton} onClick={() => doSearch('MEPS')}>
            MEPS
          </button>
          <button className={styles.smallButton} onClick={() => doSearch('Synthetic Healthcare Database for Research')}>
            SyH-DR
          </button>
        </div>

        <section style={{ marginTop: 16 }}>
          {loading && <div>Loading results…</div>}

          {!loading && data.results && data.results.length === 0 && <div>No results.</div>}
          <div className={styles.tableContainer}>
            <div style={{ padding: 12 }}>
              <ul className={styles.resultsList}>
                {data.results?.map((pkg: any) => (
                  <li key={pkg.id} className={styles.resultItem}>
                    <h3>{pkg.title || pkg.name}</h3>
                    {pkg.notes && <p>{pkg.notes}</p>}
                    <p>
                      <strong>Organization:</strong> {pkg.organization?.title || pkg.author || 'AHRQ'}
                    </p>
                    {pkg.tags && pkg.tags.length > 0 && (
                      <p>
                        <strong>Tags:</strong> {pkg.tags.map((t: any) => t.display_name || t.name).join(', ')}
                      </p>
                    )}

                    {pkg.resources && pkg.resources.length > 0 && (
                      <div>
                        <strong>Resources:</strong>
                        <ul>
                          {pkg.resources.map((r: any) => (
                            <li key={r.id || r.url}>
                              <a href={r.url} target="_blank" rel="noreferrer">
                                {r.format ? `${r.format} — ` : ''}
                                {r.name || r.url}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div style={{ marginTop: 8 }}>
                      <button className={styles.smallButton} onClick={() => viewPackage(pkg.id)}>
                        View full JSON
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {data.count && data.count > count && (
            <div className={styles.pager}>
              <button className={styles.smallButton} onClick={() => setPage(Math.max(1, page-1))} disabled={page===1}>
                Prev
              </button>
              <span>Page {page} • {Math.ceil((data.count||0)/count)} ({data.count} results)</span>
              <button className={styles.smallButton} onClick={() => setPage(page+1)} disabled={page >= Math.ceil((data.count||0)/count)}>
                Next
              </button>
            </div>
          )}
        </section>

        {selectedPkg && (
          <div className={styles.modalOverlay} onClick={() => setSelectedPkg(null)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>Package JSON</h3>
                <button className={styles.smallButton} onClick={() => setSelectedPkg(null)}>
                  Close
                </button>
              </div>
              <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(selectedPkg, null, 2)}</pre>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
