"use client"
import React, { useState } from 'react'
import Header from '@/components/Header'
import styles from '../downloads/page.module.css'

export default function LancetPage() {
  const [q, setQ] = useState('SRCTITLE(lancet)')
  const [count, setCount] = useState(5)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [openDetails, setOpenDetails] = useState<Record<string, any>>({})
  const [detailsLoading, setDetailsLoading] = useState<Record<string, boolean>>({})

  async function doSearch(e?: React.FormEvent) {
    e?.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/lancet/search?q=${encodeURIComponent(q)}&count=${count}`)
      const json = await res.json()
      if (!res.ok) setError(json.error || 'Request failed')
      else setData(json)
      // auto-fetch details for returned entries so details show immediately
      if (res.ok && json?.['search-results']?.entry?.length) {
        fetchDetailsForEntries(json['search-results'].entry)
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  async function fetchDetailsForEntries(entries: any[]) {
    const nextOpen: Record<string, any> = { ...openDetails }
    const nextLoading: Record<string, boolean> = { ...detailsLoading }

    await Promise.all(entries.map(async (entry: any, idx: number) => {
      const key = entry.eid || entry['dc:identifier'] || entry['prism:doi'] || idx
      const hrefObj = entry.link?.find((l: any) => l['@ref'] === 'self' || l['@ref'] === 'full-text' || l['@ref'] === 'scopus')
      const href = hrefObj?.['@href'] || hrefObj?.href
      nextLoading[key] = true
      if (!href) {
        nextOpen[key] = entry
        nextLoading[key] = false
        return
      }

      try {
        const r = await fetch(`/api/lancet/abstract?href=${encodeURIComponent(href)}`)
        const j = await r.json()
        if (!r.ok) nextOpen[key] = { error: j.error || 'Failed to load' }
        else nextOpen[key] = j
      } catch (err) {
        nextOpen[key] = { error: String(err) }
      } finally {
        nextLoading[key] = false
      }
    }))

    setOpenDetails(prev => ({ ...prev, ...nextOpen }))
    setDetailsLoading(prev => ({ ...prev, ...nextLoading }))
  }

  async function toggleDetails(entry: any) {
    const key = entry.eid || entry['dc:identifier'] || entry['prism:doi'] || entry['dc:title']
    if (openDetails[key]) {
      const next = { ...openDetails }
      delete next[key]
      setOpenDetails(next)
      return
    }

    const hrefObj = entry.link?.find((l: any) => l['@ref'] === 'self' || l['@ref'] === 'full-text' || l['@ref'] === 'scopus')
    const href = hrefObj?.['@href'] || hrefObj?.href
    if (!href) {
      setOpenDetails({ ...openDetails, [key]: { error: 'No detail link available', entry } })
      return
    }

    setDetailsLoading({ ...detailsLoading, [key]: true })
    try {
      const res = await fetch(`/api/lancet/abstract?href=${encodeURIComponent(href)}`)
      const json = await res.json()
      if (!res.ok) setOpenDetails({ ...openDetails, [key]: { error: json.error || 'Failed to load' } })
      else setOpenDetails({ ...openDetails, [key]: json })
    } catch (err) {
      setOpenDetails({ ...openDetails, [key]: { error: String(err) } })
    } finally {
      setDetailsLoading(prev => ({ ...prev, [key]: false }))
    }
  }

  return (
    <div className={styles.container}>
      <Header showUserMenu={true} />
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>The Lancet — Scopus Search</h1>
          <div>
            <input value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 420, padding: '8px 10px' }} />
            <input type="number" min={1} value={count} onChange={(e) => setCount(Number(e.target.value))} style={{ width: 80, marginLeft: 8, padding: '8px 6px' }} />
            <button className={styles.refreshButton} onClick={doSearch} disabled={loading} style={{ marginLeft: 8 }}>{loading ? 'Searching...' : 'Search'}</button>
          </div>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {loading ? (
          <div className={styles.loading}>Searching…</div>
        ) : data && data['search-results'] ? (
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Journal</th>
                  <th>DOI / EID</th>
                  <th>OpenAccess</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data['search-results'].entry?.map((entry: any, i: number) => {
                  const key = entry.eid || entry['dc:identifier'] || entry['prism:doi'] || i
                  const doiRaw = (entry['prism:doi'] || '').trim()
                  const doi = doiRaw && doiRaw.startsWith('http') ? doiRaw : doiRaw
                  const scopusHref = entry.link?.find((l: any) => l['@ref'] === 'scopus')?.['@href'] || null
                  const doiLink = doi ? (doi.startsWith('http') ? doi : `https://doi.org/${doi}`) : scopusHref
                  return (
                    <React.Fragment key={key}>
                      <tr>
                        <td>{entry['dc:title']}</td>
                        <td style={{ fontStyle: 'italic' }}>{entry['prism:publicationName']}</td>
                        <td>{entry['prism:doi'] || entry.eid}</td>
                        <td>{String(entry.openaccess || entry.openaccessFlag)}</td>
                        <td className={styles.actionCell}>
                          <button className={styles.refreshButton} onClick={() => toggleDetails(entry)}>
                            {openDetails[key] ? 'Hide Details' : 'Details'}
                          </button>
                        </td>
                      </tr>
                      {openDetails[key] && (
                        <tr>
                          <td colSpan={5} style={{ background: '#fcfcfd' }}>
                            {detailsLoading[key] ? (
                              <div style={{ padding: 12 }}>Loading details…</div>
                            ) : openDetails[key].error ? (
                              <div style={{ padding: 12, color: '#dc2626' }}>{openDetails[key].error}</div>
                            ) : (
                              <div style={{ padding: 12 }}>
                                <div style={{ fontWeight: 700, marginBottom: 8 }}>{openDetails[key]['dc:title'] || entry['dc:title']}</div>
                                {/* Authors */}
                                <div style={{ marginTop: 6 }}><strong>Authors:</strong>
                                  <div>
                                    {Array.isArray(openDetails[key]['author']) ? (
                                      openDetails[key]['author'].map((a: any, idx: number) => (
                                        <div key={idx}>{a['ce:given-name'] ? `${a['ce:given-name']} ${a['ce:surname'] || ''}` : a['authname'] || a['$'] || JSON.stringify(a)}</div>
                                      ))
                                    ) : openDetails[key]['dc:creator'] ? (
                                      <div>{openDetails[key]['dc:creator']}</div>
                                    ) : entry['dc:creator'] ? (
                                      <div>{entry['dc:creator']}</div>
                                    ) : <div>-</div>}
                                  </div>
                                </div>

                                {/* Affiliations */}
                                {openDetails[key].affiliation?.length ? (
                                  <div style={{ marginTop: 6 }}><strong>Affiliations:</strong>
                                    <ul>
                                      {openDetails[key].affiliation.map((a: any, i: number) => (
                                        <li key={i}>{a.affilname || a['affiliation-name'] || JSON.stringify(a)}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : null}

                                {/* Publication metadata */}
                                <div style={{ marginTop: 6 }}><strong>Journal:</strong> {openDetails[key]['prism:publicationName'] || entry['prism:publicationName'] || '-'}</div>
                                <div style={{ marginTop: 4 }}><strong>Published:</strong> {openDetails[key]['prism:coverDate'] || openDetails[key]['prism:coverDisplayDate'] || entry['prism:coverDisplayDate'] || '-'}</div>
                                <div style={{ marginTop: 4 }}><strong>Volume/Issue/Pages:</strong> {`${openDetails[key]['prism:volume'] || entry['prism:volume'] || '-'} / ${openDetails[key]['prism:issueIdentifier'] || entry['prism:issueIdentifier'] || '-'} / ${openDetails[key]['prism:pageRange'] || entry['prism:pageRange'] || '-'}`}</div>

                                <div style={{ marginTop: 6 }}><strong>DOI:</strong> {openDetails[key]['prism:doi'] || entry['prism:doi'] || '-'}</div>
                                {openDetails[key].pii && <div style={{ marginTop: 4 }}><strong>PII:</strong> {openDetails[key].pii}</div>}

                                {/* Abstracts */}
                                {openDetails[key]['dc:description'] || openDetails[key].abstracts || openDetails[key].coredata?.dcDescription ? (
                                  <div style={{ marginTop: 8 }}><strong>Abstract:</strong>
                                    <div style={{ marginTop: 6 }}>{openDetails[key]['dc:description'] || (openDetails[key].abstracts?.abstract ? openDetails[key].abstracts.abstract : openDetails[key].coredata?.dcDescription)}</div>
                                  </div>
                                ) : null}

                                {/* Keywords / Subject areas */}
                                {openDetails[key].authkeywords?.length ? (
                                  <div style={{ marginTop: 8 }}><strong>Keywords:</strong> {openDetails[key].authkeywords.join(', ')}</div>
                                ) : openDetails[key]['authkeywords'] ? (
                                  <div style={{ marginTop: 8 }}><strong>Keywords:</strong> {openDetails[key]['authkeywords']}</div>
                                ) : null}

                                {openDetails[key]['subject-areas']?.['subject-area'] ? (
                                  <div style={{ marginTop: 8 }}><strong>Subject areas:</strong> {openDetails[key]['subject-areas']['subject-area'].map((s: any) => s['$'] || s['$t'] || s['@code'] || s['$name']).join(', ')}</div>
                                ) : null}

                                <div style={{ marginTop: 8 }}><strong>OpenAccess:</strong> {String(openDetails[key].openaccess || openDetails[key].openaccessFlag || entry.openaccess || entry.openaccessFlag || false)}</div>

                                <div style={{ marginTop: 6 }}>
                                  {doiLink ? (
                                    <a href={doiLink} target="_blank" rel="noreferrer">Open full text (publisher)</a>
                                  ) : (
                                    <span>No direct publisher link available</span>
                                  )}
                                  {scopusHref && (
                                    <span style={{ marginLeft: 12 }}><a href={scopusHref} target="_blank" rel="noreferrer">Open in Scopus</a></span>
                                  )}
                                </div>

                                {/* Raw JSON expand */}
                                <details style={{ marginTop: 8 }}>
                                  <summary>Raw metadata</summary>
                                  <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto' }}>{JSON.stringify(openDetails[key], null, 2)}</pre>
                                </details>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.empty}>No results. Try clicking Search.</div>
        )}
      </main>
    </div>
  )
}
