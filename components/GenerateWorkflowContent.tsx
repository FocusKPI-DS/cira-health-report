'use client'

import { useState, useRef, useEffect } from 'react'
import { Message, SimilarProduct, DbSearchSelection, DbResults } from '@/lib/types'
import { CollectedParams } from '@/lib/useGenerateWorkflow'
import { fetchMaudeCount } from '@/lib/fda-api'
import { getAuthHeaders } from '@/lib/api-utils'
import IsoChecklistPanel from '@/components/IsoChecklistPanel'
import IntendedUseHazardPanel from '@/components/IntendedUseHazardPanel'

interface GenerateWorkflowContentProps {
  messages: Message[]
  /** ID of the most recently added search-result message */
  latestSearchMsgId: string | null
  /** Pre-fill the chat input on mount (e.g. from ?productName query param) */
  initialInputText?: string
  collected: CollectedParams
  isReadyToStart: boolean
  isLoading: boolean
  phase: 'chat' | 'generating' | 'completed'
  countdown: number | null
  workflowEndRef: React.RefObject<HTMLDivElement | null>
  sendMessage: (text: string) => void
  toggleProduct: (product: SimilarProduct) => void
  toggleDbItem: (type: DbSearchSelection['type'], value: string, keyword: string) => void
  dbSearchSelection: DbSearchSelection | null
  retrySearch: (newName: string) => void
  startAnalysisGeneration: () => void
  answerModuleQuestion?: (module: number, questionIndex: number, answer: string) => void
  confirmAndGenerate?: () => void
  isReadyToGenerate?: boolean
  pendingModeSelection?: boolean
  selectAnalysisMode?: (mode: 'simple' | 'detailed' | 'intended-use') => void
  submitIsoChecklist?: (answers: Record<string, string>) => void
  submitIntendedIsoChecklist?: (answers: Record<string, string>) => void
  submitIntendedUseHazards?: (intendedUse: string, selectedHazards: string[]) => void
  searchStartDate?: string
  searchEndDate?: string
  setSearchStartDate?: (d: string) => void
  setSearchEndDate?: (d: string) => void
  styles: Record<string, string>
  renderCompleted?: () => React.ReactNode
}

export default function GenerateWorkflowContent({
  messages,
  latestSearchMsgId,
  initialInputText,
  collected,
  isReadyToStart,
  isLoading,
  phase,
  countdown,
  workflowEndRef,
  sendMessage,
  toggleProduct,
  toggleDbItem,
  dbSearchSelection,
  retrySearch,
  startAnalysisGeneration,
  answerModuleQuestion,
  confirmAndGenerate,
  isReadyToGenerate,
  pendingModeSelection,
  selectAnalysisMode,
  submitIsoChecklist,
  submitIntendedIsoChecklist,
  submitIntendedUseHazards,
  searchStartDate: searchStartDateProp,
  searchEndDate: searchEndDateProp,
  setSearchStartDate,
  setSearchEndDate,
  styles,
  renderCompleted,
}: GenerateWorkflowContentProps) {
  const [inputText, setInputText] = useState(initialInputText ?? '')
  const [retryInput, setRetryInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // MAUDE counts keyed by product code, fetched asynchronously from our DB
  const [maudeCounts, setMaudeCounts] = useState<Record<string, number>>({})
  const fetchedCodes = useRef<Set<string>>(new Set())

  useEffect(() => {
    const allCodes = new Set<string>()
    for (const message of messages) {
      const results = message.searchResultSet
      if (!results) continue
      for (const p of results.fdaResults ?? []) {
        if (p.productCode) allCodes.add(p.productCode)
      }
      for (const p of results.aiResults ?? []) {
        if (p.productCode) allCodes.add(p.productCode)
      }
    }
    for (const code of Array.from(allCodes)) {
      if (fetchedCodes.current.has(code)) continue
      fetchedCodes.current.add(code)
      getAuthHeaders().then(headers =>
        fetchMaudeCount(code, headers as Record<string, string>).then(count => {
          setMaudeCounts(prev => ({ ...prev, [code]: count }))
        })
      )
    }
  }, [messages]) // eslint-disable-line react-hooks/exhaustive-deps

  const toDateStr = (d: Date) => d.toISOString().slice(0, 10)
  const dbStartDate = searchStartDateProp ?? '2010-01-01'
  const dbEndDate = searchEndDateProp ?? toDateStr(new Date())
  const setDbStartDate = setSearchStartDate ?? (() => {})
  const setDbEndDate = setSearchEndDate ?? (() => {})
  // Per-message override of dbResults (after date re-query)
  const [dbResultsOverride, setDbResultsOverride] = useState<Record<string, DbResults>>({})
  const [dbDateLoading, setDbDateLoading] = useState(false)

  const handleApplyDates = async (messageId: string, keyword: string) => {
    if (!keyword) return
    // Update global date state first
    setDbStartDate(dbStartDate)
    setDbEndDate(dbEndDate)
    // Trigger a new search with updated dates via retrySearch
    retrySearch(keyword)
  }

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Clear input whenever a user message is added (handles auto-submit from hook)
  useEffect(() => {
    const lastMsg = messages[messages.length - 1]
    if (lastMsg?.type === 'user') {
      setInputText('')
    }
  }, [messages.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = inputText.trim()
    if (!text) return
    setInputText('')
    sendMessage(text)
  }

  const handleRetrySubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = retryInput.trim()
    if (!q) return
    setRetryInput('')
    retrySearch(q)
  }

  const formatCountdown = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  const renderMessageContent = (content: string) => {
    const parts = content.split(/(\*\*.*?\*\*)/g)
    return (
      <p>
        {parts.map((part, i) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={i}>{part.slice(2, -2)}</strong>
            : <span key={i}>{part}</span>
        )}
      </p>
    )
  }

  const toRoman = (n: string | number) => {
    const num = typeof n === 'string' ? parseInt(n) : n
    return ({ 1: 'I', 2: 'II', 3: 'III' } as Record<number, string>)[num] ?? String(n)
  }

  const selectedIds = new Set(collected.selectedProducts.map(p => p.id))

  const renderInlineSearchResults = (message: Message) => {
    const results = message.searchResultSet
    if (!results) return null
    const fdaProducts = results.fdaResults ?? []
    const aiProducts = results.aiResults ?? []
    const isLatest = message.id === latestSearchMsgId
    const db = results.dbResults ? (dbResultsOverride[message.id] ?? results.dbResults) : null
    const keyword = results.keyword || db?.keyword || ''

    return (
      <div>
        {/* Date range filter - always show at top */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap', paddingBottom: 12, borderBottom: '1px solid #e5e7eb' }}>
          <span style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>Date range:</span>
          <input
            type="date"
            value={dbStartDate}
            onChange={e => setDbStartDate(e.target.value)}
            style={{ fontSize: 13, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
          />
          <span style={{ fontSize: 13, color: '#555' }}>to</span>
          <input
            type="date"
            value={dbEndDate}
            onChange={e => setDbEndDate(e.target.value)}
            style={{ fontSize: 13, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
          />
          <button
            onClick={() => handleApplyDates(message.id, keyword)}
            disabled={dbDateLoading || !keyword}
            style={{ fontSize: 13, padding: '4px 12px', border: '1px solid #d1d5db', borderRadius: 4, background: '#f9fafb', cursor: (dbDateLoading || !keyword) ? 'not-allowed' : 'pointer', fontWeight: 500, opacity: !keyword ? 0.5 : 1 }}
          >
            {dbDateLoading ? 'Loading…' : 'Apply'}
          </button>
        </div>

        {/* FDA results */}
        {fdaProducts.length > 0 && (
          <>
            {results.fdaResultsText && (
              <div style={{ marginBottom: 10, fontSize: 14, color: '#666' }}>
                {results.fdaResultsText}
              </div>
            )}
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>SELECT</th>
                    <th className={styles.th}>PRODUCT CODE</th>
                    <th className={styles.th}>DEVICE</th>
                    <th className={styles.th}>REGULATION DESCRIPTION</th>
                    <th className={styles.th}>MEDICAL SPECIALTY</th>
                  </tr>
                </thead>
                <tbody>
                  {fdaProducts.map((product) => (
                    <tr key={product.id} className={styles.tr}>
                      <td className={styles.td}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(product.id)}
                          onChange={() => isLatest && toggleProduct(product)}
                          disabled={!isLatest}
                          className={styles.checkbox}
                        />
                      </td>
                      <td className={styles.td}>
                        <div className={styles.productCodeCell}>
                          <span className={styles.productCode}>{product.productCode}{product.productCode in maudeCounts ? ` (${maudeCounts[product.productCode].toLocaleString()})` : ' (...)'}</span>
                          {product.fdaClassificationLink && (
                            <a href={product.fdaClassificationLink} target="_blank" rel="noopener noreferrer" className={styles.fdaLink}>
                              View FDA Classification →
                            </a>
                          )}
                        </div>
                      </td>
                      <td className={styles.td}>{product.device}</td>
                      <td className={styles.td}>{product.regulationDescription}</td>
                      <td className={styles.td}>{product.medicalSpecialty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* AI results */}
        {aiProducts.length > 0 && (
          <>
            {results.aiResultsText && (
              <div style={{ marginTop: 20, marginBottom: 10, fontSize: 14, color: '#666' }}>
                {results.aiResultsText}
              </div>
            )}
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <tbody>
                  {aiProducts.map((product) => (
                    <tr key={product.id} className={styles.tr}>
                      <td className={styles.td} style={{ width: 80, verticalAlign: 'top', paddingTop: 20 }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(product.id)}
                          onChange={() => isLatest && toggleProduct(product)}
                          disabled={!isLatest}
                          className={styles.checkbox}
                        />
                      </td>
                      <td className={styles.td}>
                        <div style={{ lineHeight: 1.6 }}>
                          <div>
                            <strong>Product Code:</strong> {product.productCode}{product.productCode in maudeCounts ? ` (${maudeCounts[product.productCode].toLocaleString()})` : ' (...)'}
                            {product.fdaClassificationLink && (
                              <>&nbsp;&nbsp;&nbsp;<a href={product.fdaClassificationLink} target="_blank" rel="noopener noreferrer" className={styles.fdaLink} style={{ fontSize: 12 }}>View FDA Classification</a></>
                            )}
                          </div>
                          {product.deviceName && <div><strong>Device Name:</strong> {product.deviceName}</div>}
                          {product.regulationNumber && (
                            <div>
                              <strong>Regulation Number:</strong>&nbsp;
                              <a href={`https://www.ecfr.gov/current/title-21/section-${product.regulationNumber}`} target="_blank" rel="noopener noreferrer" className={styles.fdaLink}>
                                {product.regulationNumber}
                              </a>
                            </div>
                          )}
                          {product.deviceClass && <div><strong>Device Class:</strong> Class {toRoman(product.deviceClass)}</div>}
                          {product.reason && <div><strong>Reason:</strong> {product.reason}</div>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* DB results */}
        {results.dbResults && (() => {
          const sel = dbSearchSelection

          const isAllChecked = sel?.type === 'keyword'
          const isBrandChecked = (v: string) => sel?.type === 'brand_name' && sel.values.includes(v)
          const isGenericChecked = (v: string) => sel?.type === 'generic_name' && sel.values.includes(v)
          const isCodeChecked = (v: string) => sel?.type === 'product_code' && sel.values.includes(v)

          return (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 14, color: '#666', marginBottom: 10 }}>
                Our database contains <strong>{db!.total.toLocaleString()}</strong> MAUDE events matching &quot;{db!.keyword}&quot;. Select a grouping below to use as analysis source.
              </div>

              {/* All */}
              <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: isLatest ? 'pointer' : 'default', fontWeight: 600, fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={isAllChecked}
                    onChange={() => isLatest && toggleDbItem('keyword', db.keyword, db.keyword)}
                    disabled={!isLatest}
                    className={styles.checkbox}
                  />
                  All ({db.total.toLocaleString()} records)
                </label>
              </div>

              {/* By Brand */}
              {db.by_brand.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    The following {db.by_brand.length} result{db.by_brand.length !== 1 ? 's are' : ' is'} classified by brand name
                  </div>
                  <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                    {db.by_brand.map(item => (
                      <label key={item.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: isLatest ? 'pointer' : 'default', fontSize: 13, borderBottom: '1px solid #f3f4f6' }}>
                        <input
                          type="checkbox"
                          checked={isBrandChecked(item.value)}
                          onChange={() => isLatest && toggleDbItem('brand_name', item.value, db.keyword)}
                          disabled={!isLatest}
                          className={styles.checkbox}
                        />
                        <span style={{ flex: 1 }}>{item.value}</span>
                        <span style={{ color: '#9ca3af', fontSize: 12 }}>{item.count.toLocaleString()}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* By Generic Name */}
              {db.by_generic.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    The following {db.by_generic.length} result{db.by_generic.length !== 1 ? 's are' : ' is'} classified by generic name
                  </div>
                  <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                    {db.by_generic.map(item => (
                      <label key={item.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: isLatest ? 'pointer' : 'default', fontSize: 13, borderBottom: '1px solid #f3f4f6' }}>
                        <input
                          type="checkbox"
                          checked={isGenericChecked(item.value)}
                          onChange={() => isLatest && toggleDbItem('generic_name', item.value, db.keyword)}
                          disabled={!isLatest}
                          className={styles.checkbox}
                        />
                        <span style={{ flex: 1 }}>{item.value}</span>
                        <span style={{ color: '#9ca3af', fontSize: 12 }}>{item.count.toLocaleString()}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* By Product Code */}
              {db.by_product_code.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                    The following {db.by_product_code.length} result{db.by_product_code.length !== 1 ? 's are' : ' is'} classified by product code
                  </div>
                  <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
                    {db.by_product_code.map(item => (
                      <label key={item.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', cursor: isLatest ? 'pointer' : 'default', fontSize: 13, borderBottom: '1px solid #f3f4f6' }}>
                        <input
                          type="checkbox"
                          checked={isCodeChecked(item.value)}
                          onChange={() => isLatest && toggleDbItem('product_code', item.value, db.keyword)}
                          disabled={!isLatest}
                          className={styles.checkbox}
                        />
                        <span style={{ flex: 1 }}>{item.value}</span>
                        <span style={{ color: '#9ca3af', fontSize: 12 }}>{item.count.toLocaleString()}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* Search again + Generate Report — only on the latest search message */}
        {isLatest && (
          <>
            <form onSubmit={handleRetrySubmit} className={styles.searchAgainForm} style={{ marginTop: 16 }}>
              <input
                type="text"
                value={retryInput}
                onChange={e => setRetryInput(e.target.value)}
                className={styles.searchAgainInput}
                placeholder="Search again with a different name..."
              />
              <button type="submit" className={styles.searchAgainButton}>Search Again</button>
            </form>

            {(isReadyToStart || dbSearchSelection !== null) && (
              <button
                className={styles.generateButton}
                onClick={startAnalysisGeneration}
                disabled={collected.selectedProducts.length === 0 && dbSearchSelection === null}
                style={{ marginTop: 16 }}
              >
                Continue →
              </button>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div className={styles.workflow}>
      {/* ── Sticky floating info bar ── */}
      {phase === 'chat' && (() => {
        const dbSel = dbSearchSelection
        let selectionLabel = ''
        const hasSelection = collected.selectedProducts.length > 0 || dbSel !== null

        if (hasSelection) {
          if (dbSel) {
            if (dbSel.type === 'keyword') {
              selectionLabel = `All MAUDE events for "${dbSel.keyword}"`
            } else {
              const typeLabel = dbSel.type === 'brand_name' ? 'Brand' : dbSel.type === 'generic_name' ? 'Generic' : 'Product Code'
              selectionLabel = `${typeLabel}: ${dbSel.values.join(', ')}`
            }
          } else {
            selectionLabel = `FDA codes: ${collected.productCodes.join(', ')}`
          }
        }

        return (
          <div style={{
            position: 'sticky',
            top: 8,
            zIndex: 20,
            display: 'flex',
            justifyContent: 'flex-end',
            pointerEvents: 'none',
            marginBottom: 4,
          }}>
            <div style={{
              pointerEvents: 'auto',
              background: '#fff',
              border: '1px solid #d1d5db',
              borderRadius: 10,
              padding: '8px 14px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
              fontSize: 13,
              lineHeight: 1.6,
            }}>
              <div style={{ color: '#555' }}>
                Date range:{' '}
                <strong style={{ color: '#111' }}>{dbStartDate} to {dbEndDate}</strong>
              </div>
              {hasSelection && (
                <div style={{ color: '#555' }}>
                  Selected:{' '}
                  <strong style={{ color: '#111' }}>{selectionLabel}</strong>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── Message history (search results are embedded inside matching messages) ── */}
      {messages.map((message) => (
        <div key={message.id} className={styles.message}>
          {message.type === 'ai' && (
            <div className={styles.messageHeader}>
              <div className={styles.aiAvatar}>
                <img src="/favicon.ico" alt="CiraHealth AI" className={styles.aiAvatarImage} />
              </div>
            </div>
          )}
          <div className={`${styles.messageContent} ${message.type === 'user' ? styles.userMessage : ''}`}>
            {renderMessageContent(message.content)}
            {message.searchResultSet && renderInlineSearchResults(message)}
            {message.moduleQuestion && answerModuleQuestion && (
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {message.moduleQuestion.options.map((option) => (
                  <button
                    key={option}
                    onClick={() => answerModuleQuestion(
                      message.moduleQuestion!.module,
                      message.moduleQuestion!.question_index,
                      option
                    )}
                    disabled={isLoading}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 6,
                      border: '1px solid #d1d5db',
                      background: '#f9fafb',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      fontSize: 13,
                      fontWeight: 500,
                      color: '#374151',
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
            {message.hazardSummary && (
              <div style={{ marginTop: 12 }}>
                <ul style={{ paddingLeft: 20, margin: '0 0 16px' }}>
                  {message.hazardSummary.hazard_categories.map((cat) => (
                    <li key={cat} style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>{cat}</li>
                  ))}
                </ul>
                {isReadyToGenerate && confirmAndGenerate && (
                  <button
                    className={styles.generateButton}
                    onClick={confirmAndGenerate}
                    disabled={isLoading}
                    style={{ width: 'auto', marginTop: 0 }}
                  >
                    Generate Report
                  </button>
                )}
              </div>
            )}
            {message.isoChecklist && (submitIsoChecklist || submitIntendedIsoChecklist) && (
              <IsoChecklistPanel
                onSubmit={message.isoChecklistDefaults && submitIntendedIsoChecklist ? submitIntendedIsoChecklist : submitIsoChecklist!}
                isLoading={isLoading}
                disabled={phase !== 'chat'}
                styles={styles}
                defaultAnswers={message.isoChecklistDefaults}
              />
            )}
            {message.intendedUseHazard && submitIntendedUseHazards && (
              <IntendedUseHazardPanel
                onSubmit={submitIntendedUseHazards}
                isLoading={isLoading}
                disabled={phase !== 'chat'}
                styles={styles}
              />
            )}
          </div>
        </div>
      ))}

      {/* ── Mode selection buttons ── */}
      {pendingModeSelection && selectAnalysisMode && phase === 'chat' && (
        <div className={styles.message}>
          <div className={styles.messageContent}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
              <button
                onClick={() => selectAnalysisMode('simple')}
                disabled={isLoading}
                className={styles.generateButton}
                style={{ width: 'auto', marginTop: 0 }}
              >
                Simple Analysis
              </button>
              <button
                onClick={() => selectAnalysisMode('detailed')}
                disabled={isLoading}
                className={styles.generateButton}
                style={{ width: 'auto', marginTop: 0 }}
              >
                More Questions
              </button>
              <button
                onClick={() => selectAnalysisMode('intended-use')}
                disabled={isLoading}
                className={styles.generateButton}
                style={{ width: 'auto', marginTop: 0 }}
              >
                Input Intended Use
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Loading indicator ── */}
      {isLoading && phase === 'chat' && (
        <div className={styles.message}>
          <div className={styles.messageHeader}>
            <div className={styles.aiAvatar}>
              <img src="/favicon.ico" alt="CiraHealth AI" className={styles.aiAvatarImage} />
            </div>
          </div>
          <div className={styles.messageContent}>
            <div className={styles.loadingSpinner}>⏳</div>
          </div>
        </div>
      )}

      {/* ── Generating phase ── */}
      {phase === 'generating' && (
        <div className={styles.message}>
          <div className={styles.messageHeader}>
            <div className={styles.aiAvatar}>
              <img src="/favicon.ico" alt="CiraHealth AI" className={styles.aiAvatarImage} />
            </div>
          </div>
          <div className={styles.messageContent}>
            <div className={styles.loadingSpinner}>
              ⏳
              {countdown !== null && (
                <span style={{ marginLeft: 8, fontSize: 14 }}>{formatCountdown(countdown)}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Completed phase ── */}
      {phase === 'completed' && renderCompleted && renderCompleted()}

      {/* ── Chat input (only in chat phase) ── */}
      {phase === 'chat' && (
        <div className={`${styles.message} ${styles.chatInputMessage}`}>
          <div className={styles.messageContent}>
            <form onSubmit={handleSubmit} className={styles.chatInputForm}>
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                className={styles.inlineInput}
                placeholder={isLoading ? 'Thinking...' : 'Type your message...'}
                disabled={isLoading}
                autoFocus
              />
              <button
                type="submit"
                className={`${styles.inlineButton} ${isLoading ? styles.loading : ''}`}
                disabled={isLoading || !inputText.trim()}
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      <div ref={workflowEndRef} />
    </div>
  )
}
