'use client'

import { useState, useRef, useEffect } from 'react'
import { Message, SimilarProduct } from '@/lib/types'
import { CollectedParams, SearchResultSet } from '@/lib/useGenerateWorkflow'

interface GenerateWorkflowContentProps {
  messages: Message[]
  suggestedOptions: string[]
  searchResults: SearchResultSet | null
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
  suggestedOptions,
  searchResults,
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
  const [inputText, setInputText] = useState('')
  const [retryInput, setRetryInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = inputText.trim()
    if (!text) return
    setInputText('')
    sendMessage(text)
  }

  const handleOptionClick = (option: string) => {
    sendMessage(option)
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

  const fdaProducts = searchResults?.fdaResults ?? []
  const aiProducts = searchResults?.aiResults ?? []
  const hasSearchResults = fdaProducts.length > 0 || aiProducts.length > 0
  const noResultsFound = searchResults !== null && !hasSearchResults
  const selectedIds = new Set(collected.selectedProducts.map(p => p.id))

  return (
    <div className={styles.workflow}>
      {/* ── Message history ── */}
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
          </div>
        </div>
      ))}

      {/* ── Suggested quick-reply options ── */}
      {suggestedOptions.length > 0 && phase === 'chat' && !isLoading && (
        <div className={styles.message}>
          <div className={styles.messageHeader}>
            <div className={styles.aiAvatar}>
              <img src="/favicon.ico" alt="CiraHealth AI" className={styles.aiAvatarImage} />
            </div>
          </div>
          <div className={styles.messageContent}>
            <div className={styles.buttonGroup}>
              {suggestedOptions.map((opt, i) => (
                <button
                  key={i}
                  className={styles.choiceButton}
                  onClick={() => handleOptionClick(opt)}
                >
                  {opt}
                </button>
              ))}
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
            <div className={styles.loading}>⏳</div>
          </div>
        </div>
      )}

      {/* ── FDA Search results table ── */}
      {hasSearchResults && phase === 'chat' && (
        <div className={styles.message}>
          <div className={styles.messageHeader}>
            <div className={styles.aiAvatar}>
              <img src="/favicon.ico" alt="CiraHealth AI" className={styles.aiAvatarImage} />
            </div>
          </div>
          <div className={styles.messageContent}>
            {/* FDA results */}
            {fdaProducts.length > 0 && (
              <>
                {searchResults?.fdaResultsText && (
                  <div style={{ marginBottom: 10, fontSize: 14, color: '#666' }}>
                    {searchResults.fdaResultsText}
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
                              onChange={() => toggleProduct(product)}
                              className={styles.checkbox}
                            />
                          </td>
                          <td className={styles.td}>
                            <div className={styles.productCodeCell}>
                              <span className={styles.productCode}>{product.productCode}</span>
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
                {searchResults?.aiResultsText && (
                  <div style={{ marginTop: 20, marginBottom: 10, fontSize: 14, color: '#666' }}>
                    {searchResults.aiResultsText}
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
                              onChange={() => toggleProduct(product)}
                              className={styles.checkbox}
                            />
                          </td>
                          <td className={styles.td}>
                            <div style={{ lineHeight: 1.6 }}>
                              <div>
                                <strong>Product Code:</strong> {product.productCode}
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

            {/* Search again */}
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

            {/* Generate button */}
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
          </div>
        </div>
      )}

      {/* ── No results: retry form ── */}
      {noResultsFound && phase === 'chat' && (
        <div className={styles.message}>
          <div className={styles.messageHeader}>
            <div className={styles.aiAvatar}>
              <img src="/favicon.ico" alt="CiraHealth AI" className={styles.aiAvatarImage} />
            </div>
          </div>
          <div className={styles.messageContent}>
            <form onSubmit={handleRetrySubmit} className={styles.inlineForm}>
              <input
                type="text"
                value={retryInput}
                onChange={e => setRetryInput(e.target.value)}
                className={styles.inlineInput}
                placeholder="Enter a more general device name"
                autoFocus
              />
              <button type="submit" className={styles.inlineButton}>Search Again</button>
            </form>
          </div>
        </div>
      )}

      {/* ── Standalone Generate button (if ready but no search widget showing) ── */}
      {isReadyToStart && !hasSearchResults && phase === 'chat' && collected.selectedProducts.length > 0 && (
        <div className={styles.message}>
          <div className={styles.messageHeader}>
            <div className={styles.aiAvatar}>
              <img src="/favicon.ico" alt="CiraHealth AI" className={styles.aiAvatarImage} />
            </div>
          </div>
          <div className={styles.messageContent}>
            <button className={styles.generateButton} onClick={startAnalysisGeneration}>
              Generate Report
            </button>
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

      {/* ── Chat input (only in chat phase, right-aligned like a user message) ── */}
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

