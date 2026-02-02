"use client"
import React, { useState } from 'react'
import Header from '@/components/Header'
import styles from '../downloads/page.module.css'

function reconstructAbstract(invIndex: Record<string, number[]>) {
  try {
    const positions: string[] = []
    for (const [word, idxs] of Object.entries(invIndex || {})) {
      for (const pos of idxs) positions[pos] = word
    }
    return positions.filter(Boolean).join(' ') || ''
  } catch {
    return ''
  }
}

export default function JamaPage() {
  const [q, setQ] = useState('')
  const [count, setCount] = useState(5)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  React.useEffect(() => {
    // auto-run search for JAMA top N on mount
    doSearch().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function doSearch(e?: React.FormEvent) {
    e?.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(`/api/jama/search?q=${encodeURIComponent(q)}&count=${count}`)
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Request failed')
      else setResult(json)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <Header showUserMenu={true} />
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>JAMA — OpenAlex Search</h1>
          <div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="optional query within JAMA" style={{ width: 420, padding: '8px 10px' }} />
            <input type="number" min={1} value={count} onChange={(e) => setCount(Number(e.target.value))} style={{ width: 80, marginLeft: 8, padding: '8px 6px' }} />
            <button className={styles.refreshButton} onClick={doSearch} disabled={loading} style={{ marginLeft: 8 }}>{loading ? 'Searching...' : 'Search JAMA'}</button>
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {loading ? (
          <div className={styles.loading}>Searching OpenAlex…</div>
        ) : result ? (
          <div>
            <div style={{ marginBottom: 12 }}><strong>Source:</strong> {result.source?.display_name || 'JAMA'}</div>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Authors</th>
                    <th>Pub date</th>
                    <th>DOI</th>
                    <th>Citations</th>
                  </tr>
                </thead>
                <tbody>
                  {result.works?.results?.map((w: any, i: number) => {
                    const authors = (w.authorships || []).map((a: any) => a.author?.display_name).filter(Boolean).slice(0, 5).join(', ')
                    const doi = (w.ids?.doi || w.doi || '')
                    const doiLink = doi ? (doi.startsWith('http') ? doi : `https://doi.org/${doi}`) : null
                    const abs = w.abstract || (w.abstract_inverted_index ? reconstructAbstract(w.abstract_inverted_index) : '')
                    const best = w.best_oa_location || w.primary_location || null
                    return (
                      <React.Fragment key={w.id || i}>
                        <tr>
                          <td style={{ maxWidth: 420 }}>{w.display_name}</td>
                          <td>{authors || '-'}</td>
                          <td>{w.publication_date || w.publication_year || '-'}</td>
                          <td>{doi ? <a href={doiLink} target="_blank" rel="noreferrer">{doiLink}</a> : '-'}</td>
                          <td>{w.cited_by_count ?? '-'}</td>
                        </tr>

                        <tr>
                          <td colSpan={5} style={{ background: '#fcfcfd' }}>
                            <div style={{ padding: 12 }}>
                              <div style={{ fontWeight: 700, marginBottom: 6 }}>{w.display_name}</div>
                              {abs ? (
                                <div style={{ marginBottom: 8 }}><strong>Abstract:</strong>
                                  <div style={{ marginTop: 6 }}>{abs}</div>
                                </div>
                              ) : null}

                              {w.keywords?.length ? (
                                <div style={{ marginBottom: 6 }}><strong>Keywords:</strong> {w.keywords.map((k:any)=>k.display_name).join(', ')}</div>
                              ) : null}

                              {w.topics?.length ? (
                                <div style={{ marginBottom: 6 }}><strong>Topics:</strong> {w.topics.map((t:any)=>t.display_name).join(', ')}</div>
                              ) : null}

                              {best ? (
                                <div style={{ marginBottom: 6 }}><strong>Best OA / Landing:</strong> {best.landing_page_url || best.pdf_url || best.id || '-'}</div>
                              ) : null}

                              {w.biblio ? (
                                <div style={{ marginBottom: 6 }}><strong>Biblio:</strong> {`${w.biblio.volume || '-'} / ${w.biblio.issue || '-'} / ${w.biblio.first_page || '-'}-${w.biblio.last_page || '-'}`}</div>
                              ) : null}

                              {w.authorships?.length ? (
                                <div style={{ marginBottom: 6 }}><strong>Authorships (sample):</strong>
                                  <ul>
                                    {w.authorships.slice(0,5).map((a:any, idx:number)=>(<li key={idx}>{a.author?.display_name || a.raw_author_name} {a.affiliations?.map((af:any)=>af.raw_affiliation_string).filter(Boolean).join('; ')}</li>))}
                                  </ul>
                                </div>
                              ) : null}

                              <div style={{ marginTop: 8 }}>
                                <a href={w.id} target="_blank" rel="noreferrer">Open in OpenAlex</a>
                                {doiLink && <span style={{ marginLeft: 12 }}><a href={doiLink} target="_blank" rel="noreferrer">Publisher DOI</a></span>}
                              </div>

                              <details style={{ marginTop: 8 }}>
                                <summary>Raw work JSON</summary>
                                <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto' }}>{JSON.stringify(w, null, 2)}</pre>
                              </details>
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <details style={{ marginTop: 12 }}>
              <summary>Raw response</summary>
              <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto' }}>{JSON.stringify(result, null, 2)}</pre>
            </details>
          </div>
        ) : (
          <div className={styles.empty}>No results. Try Search JAMA.</div>
        )}
      </main>
    </div>
  )
}
