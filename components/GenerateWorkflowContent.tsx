'use client'

import { useState, useRef, useEffect } from 'react'
import { Message, SimilarProduct } from '@/lib/types'
import { CollectedParams } from '@/lib/useGenerateWorkflow'
import { fetchMaudeCount } from '@/lib/fda-api'

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
  retrySearch: (newName: string) => void
  startAnalysisGeneration: () => void
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
  retrySearch,
  startAnalysisGeneration,
  styles,
  renderCompleted,
}: GenerateWorkflowContentProps) {
  const [inputText, setInputText] = useState(initialInputText ?? '')
  const [retryInput, setRetryInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // MAUDE counts keyed by product code, fetched asynchronously from openFDA
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
    for (const code of allCodes) {
      if (fetchedCodes.current.has(code)) continue
      fetchedCodes.current.add(code)
      fetchMaudeCount(code).then(count => {
        setMaudeCounts(prev => ({ ...prev, [code]: count }))
      })
    }
  }, [messages]) // eslint-disable-line react-hooks/exhaustive-deps

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

    return (
      <div>
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

            {isReadyToStart && (
              <button
                className={styles.generateButton}
                onClick={startAnalysisGeneration}
                disabled={collected.selectedProducts.length === 0}
                style={{ marginTop: 16 }}
              >
                Generate Report
              </button>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div className={styles.workflow}>
      {/* ── Sticky floating action bar (visible when products are selected) ── */}
      {collected.selectedProducts.length > 0 && phase === 'chat' && (
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
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 13,
            lineHeight: 1.4,
          }}>
            <span style={{ color: '#555' }}>
              Checked:{' '}
              <strong style={{ color: '#111' }}>
                {collected.productCodes.join(', ')}
              </strong>
            </span>
            <button
              className={styles.generateButton}
              onClick={startAnalysisGeneration}
              disabled={isLoading}
              style={{ width: 'auto', marginTop: 0 }}
            >
              Generate Report
            </button>
          </div>
        </div>
      )}

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
          </div>
        </div>
      ))}

      {/* ── Loading indicator ── */}
      {isLoading && phase === 'chat' && (
        <div className={styles.message}>
          <div className={styles.messageHeader}>
            <div className={styles.aiAvatar}>
              <img src="/favicon.ico" alt="CiraHealth AI" className={styles.aiAvatarImage} />
            </div>
          </div>
          <div className={styles.messageContent}>
            <div className={styles.loading}>⏳</div>
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
            <div className={styles.loading}>
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
                className={styles.inlineButton}
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
