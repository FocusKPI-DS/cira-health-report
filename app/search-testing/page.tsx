'use client'

import { useState } from 'react'
import { getAuthHeaders } from '@/lib/api-utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'

interface DbResultGroup { value: string; count: number }
interface DbResults { total: number; keyword: string; by_brand: DbResultGroup[]; by_generic: DbResultGroup[]; by_product_code: DbResultGroup[] }
interface SearchResult {
  fda_results: any[]
  ai_results: any[]
  fda_results_text: string
  ai_results_text: string
  db_results?: DbResults
  query?: string
}

export default function SearchTestingPage() {
  const [query, setQuery] = useState('')
  const [searchType, setSearchType] = useState<'keywords' | 'product-code'>('keywords')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState<number | null>(null)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setLoading(true)
    setError(null)
    setResult(null)
    setElapsed(null)
    const t0 = Date.now()
    try {
      const headers = await getAuthHeaders()
      const params = new URLSearchParams({ search_type: searchType, limit: '20' })
      if (searchType === 'keywords') params.set('deviceName', q)
      else params.set('productCode', q)

      const resp = await fetch(`${API_URL}/api/v1/anonclient/search-fda-products?${params}`, { headers })
      const data = await resp.json()
      setElapsed(Date.now() - t0)
      if (!resp.ok) {
        setError(data.detail || resp.statusText)
      } else {
        setResult(data)
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px', fontFamily: 'monospace' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>Search API Testing</h1>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <select
          value={searchType}
          onChange={e => setSearchType(e.target.value as 'keywords' | 'product-code')}
          style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
        >
          <option value="keywords">Keywords (device name)</option>
          <option value="product-code">Product Code (3-letter)</option>
        </select>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={searchType === 'keywords' ? 'e.g. zio at, ct scanner' : 'e.g. KZH'}
          style={{ flex: 1, minWidth: 220, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 14 }}
          autoFocus
        />
        <button
          type="submit"
          disabled={loading}
          style={{ padding: '6px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 6, padding: 12, marginBottom: 16, color: '#b91c1c', fontSize: 13 }}>
          {error}
        </div>
      )}

      {result && (
        <div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            {elapsed !== null && `${elapsed}ms · `}
            FDA: {result.fda_results.length} · AI: {result.ai_results.length} · DB: {result.db_results?.total ?? '—'}
          </div>

          {/* FDA Results */}
          {result.fda_results.length > 0 && (
            <Section title={`FDA Results (${result.fda_results.length})`} subtitle={result.fda_results_text}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {['productCode', 'device', 'regulationDescription', 'medicalSpecialty'].map(k => (
                      <th key={k} style={thStyle}>{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.fda_results.map((r, i) => (
                    <tr key={i}>
                      <td style={tdStyle}>{r.productCode}</td>
                      <td style={tdStyle}>{r.device}</td>
                      <td style={tdStyle}>{r.regulationDescription}</td>
                      <td style={tdStyle}>{r.medicalSpecialty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* AI Results */}
          {result.ai_results.length > 0 && (
            <Section title={`AI Results (${result.ai_results.length})`} subtitle={result.ai_results_text}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    {['productCode', 'deviceName', 'deviceClass', 'reason'].map(k => (
                      <th key={k} style={thStyle}>{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.ai_results.map((r, i) => (
                    <tr key={i}>
                      <td style={tdStyle}>{r.productCode}</td>
                      <td style={tdStyle}>{r.deviceName}</td>
                      <td style={tdStyle}>{r.deviceClass}</td>
                      <td style={{ ...tdStyle, maxWidth: 300, whiteSpace: 'normal' }}>{r.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* DB Results */}
          {result.db_results && (
            <Section title={`MAUDE DB Results — ${result.db_results.total.toLocaleString()} total`} subtitle={`Keyword: "${result.db_results.keyword}"`}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <GroupList title="By Brand" items={result.db_results.by_brand} />
                <GroupList title="By Generic Name" items={result.db_results.by_generic} />
                <GroupList title="By Product Code" items={result.db_results.by_product_code} />
              </div>
            </Section>
          )}

          {/* Raw JSON toggle */}
          <details style={{ marginTop: 24 }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, color: '#6b7280' }}>Raw JSON</summary>
            <pre style={{ background: '#f3f4f6', padding: 12, borderRadius: 6, fontSize: 11, overflow: 'auto', maxHeight: 400, marginTop: 8 }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{title}</h2>
      {subtitle && <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{subtitle}</div>}
      {children}
    </div>
  )
}

function GroupList({ title, items }: { title: string; items: DbResultGroup[] }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#374151' }}>{title}</div>
      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: '#9ca3af' }}>—</div>
      ) : (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
          {items.map(item => (
            <div key={item.value} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px', fontSize: 12, borderBottom: '1px solid #f3f4f6' }}>
              <span>{item.value}</span>
              <span style={{ color: '#9ca3af' }}>{item.count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12 }
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '6px 10px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontWeight: 600, whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { padding: '5px 10px', borderBottom: '1px solid #f3f4f6', verticalAlign: 'top' }
