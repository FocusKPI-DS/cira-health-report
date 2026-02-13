'use client'

import { Message, WorkflowStep, SimilarProduct } from '@/lib/types'

interface GenerateWorkflowContentProps {
  messageHistory: Message[]
  currentStep: WorkflowStep
  productName: string
  setProductName: (name: string) => void
  intendedUse: string
  setIntendedUse: (use: string) => void
  selectedProducts: Set<string>
  similarProducts: SimilarProduct[]
  workflowEndRef: React.RefObject<HTMLDivElement | null>
  handleDeviceNameSubmit: (e: React.FormEvent) => void
  handleIntendedUseAnswer: (hasIntendedUse: boolean) => void
  handleIntendedUseSubmit: (e: React.FormEvent) => void
  handleRetrySearch: (e?: React.FormEvent) => void
  handleNewSearch: (e: React.FormEvent) => void
  handleToggleProduct: (productId: string) => void
  handleGenerateReport: () => void
  isSubmitting?: boolean
  styles: Record<string, string>
  renderCompleted?: () => React.ReactNode
  countdown?: number | null
}

export default function GenerateWorkflowContent({
  messageHistory,
  currentStep,
  productName,
  setProductName,
  intendedUse,
  setIntendedUse,
  selectedProducts,
  similarProducts,
  workflowEndRef,
  handleDeviceNameSubmit,
  handleIntendedUseAnswer,
  handleIntendedUseSubmit,
  handleRetrySearch,
  handleNewSearch,
  handleToggleProduct,
  handleGenerateReport,
  isSubmitting = false,
  styles,
  renderCompleted,
  countdown
}: GenerateWorkflowContentProps) {
  
  const renderMessageContent = (message: Message) => {
    // Parse bold markdown
    const parts = message.content.split(/(\*\*.*?\*\*)/g)
    return (
      <p>
        {parts.map((part, index) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={index}>{part.slice(2, -2)}</strong>
          }
          return <span key={index}>{part}</span>
        })}
      </p>
    )
  }

  const formatCountdown = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const toRoman = (num: string | number): string => {
    const n = typeof num === 'string' ? parseInt(num) : num
    if (isNaN(n)) return String(num)
    const romanNumerals: { [key: number]: string } = {
      1: 'I',
      2: 'II',
      3: 'III'
    }
    return romanNumerals[n] || String(num)
  }

  return (
    <div className={styles.workflow}>
      {/* Render message history */}
      {messageHistory.map((message) => (
        <div key={message.id} className={styles.message}>
          {message.type === 'ai' && (
            <div className={styles.messageHeader}>
              <div className={styles.aiAvatar}>
                <img src="/favicon.ico" alt="CiraHealth AI" className={styles.aiAvatarImage} />
              </div>
            </div>
          )}
          <div className={`${styles.messageContent} ${message.type === 'user' ? styles.userMessage : ''}`}>
            {renderMessageContent(message)}
          </div>
        </div>
      ))}

      {/* Device Name Step */}
      {currentStep === 'device-name' && (
        <div className={styles.message}>
          <div className={styles.messageHeader}>
            <div className={styles.aiAvatar}>
              <img src="/favicon.ico" alt="CiraHealth AI" className={styles.aiAvatarImage} />
            </div>
          </div>
          <div className={styles.messageContent}>
            <form onSubmit={handleDeviceNameSubmit} className={styles.inlineForm}>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className={styles.inlineInput}
                placeholder="Enter device name"
                required
                autoFocus
              />
              <button type="submit" className={styles.inlineButton}>
                Submit
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Intended Use Question Step */}
      {currentStep === 'intended-use-question' && (
        <div className={styles.message}>
          <div className={styles.messageHeader}>
            <div className={styles.aiAvatar}>
              <img src="/favicon.ico" alt="CiraHealth AI" className={styles.aiAvatarImage} />
            </div>
          </div>
          <div className={styles.messageContent}>
            <p>Do you have a more detailed intended use for this device?</p>
            <div className={styles.buttonGroup}>
              <button 
                className={styles.choiceButton}
                onClick={() => handleIntendedUseAnswer(true)}
              >
                Yes
              </button>
              <button 
                className={styles.choiceButton}
                onClick={() => handleIntendedUseAnswer(false)}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Intended Use Input Step */}
      {currentStep === 'intended-use-input' && (
        <div className={styles.message}>
          <div className={styles.messageHeader}>
            <div className={styles.aiAvatar}>
              <img src="/favicon.ico" alt="CiraHealth AI" className={styles.aiAvatarImage} />
            </div>
          </div>
          <div className={styles.messageContent}>
            <form onSubmit={handleIntendedUseSubmit} className={styles.inlineForm}>
              <textarea
                value={intendedUse}
                onChange={(e) => setIntendedUse(e.target.value)}
                className={styles.inlineTextarea}
                placeholder="Describe the intended use"
                required
                autoFocus
              />
              <button type="submit" className={styles.inlineButton}>
                Submit
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Searching Products Step */}
      {currentStep === 'searching-products' && (
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

      {/* No Products Found Step */}
      {currentStep === 'no-products-found' && (
        <div className={styles.message}>
          <div className={styles.messageHeader}>
            <div className={styles.aiAvatar}>
              <img src="/favicon.ico" alt="CiraHealth AI" className={styles.aiAvatarImage} />
            </div>
          </div>
          <div className={styles.messageContent}>
            <form onSubmit={handleRetrySearch} className={styles.inlineForm}>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className={styles.inlineInput}
                placeholder="Enter a more general device name"
                required
                autoFocus
              />
              <button type="submit" className={styles.inlineButton}>
                Search Again
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Similar Products Step */}
      {currentStep === 'similar-products' && (
        <div className={styles.message}>
          <div className={styles.messageHeader}>
            <div className={styles.aiAvatar}>
              <img src="/favicon.ico" alt="CiraHealth AI" className={styles.aiAvatarImage} />
            </div>
          </div>
          <div className={styles.messageContent}>
            <form onSubmit={handleNewSearch} className={styles.searchAgainForm}>
              <input
                type="text"
                defaultValue={productName}
                className={styles.searchAgainInput}
                placeholder="Enter a different device name to search again"
              />
              <button type="submit" className={styles.searchAgainButton}>
                Search Again
              </button>
            </form>
            
            {/* Separate FDA and AI results */}
            {(() => {
              const fdaProducts = similarProducts.filter(p => p.source !== 'ai')
              const aiProducts = similarProducts.filter(p => p.source === 'ai')
              
              return (
                <>
                  {/* FDA Results Table */}
                  {fdaProducts.length > 0 && (
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
                                  checked={selectedProducts.has(product.id)}
                                  onChange={() => handleToggleProduct(product.id)}
                                  className={styles.checkbox}
                                />
                              </td>
                              <td className={styles.td}>
                                <div className={styles.productCodeCell}>
                                  <span className={styles.productCode}>{product.productCode}</span>
                                  {product.fdaClassificationLink && (
                                    <a
                                      href={product.fdaClassificationLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={styles.fdaLink}
                                    >
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
                  )}
                  
                  {/* AI Results Table */}
                  {aiProducts.length > 0 && (
                    <div className={styles.tableContainer}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th className={styles.th}>SELECT</th>
                            <th className={styles.th}>AI Suggestions Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aiProducts.map((product) => (
                            <tr key={product.id} className={styles.tr}>
                              <td className={styles.td} style={{ width: '80px', verticalAlign: 'top', paddingTop: '20px' }}>
                                <input
                                  type="checkbox"
                                  checked={selectedProducts.has(product.id)}
                                  onChange={() => handleToggleProduct(product.id)}
                                  className={styles.checkbox}
                                />
                              </td>
                              <td className={styles.td}>
                                <div style={{ lineHeight: '1.6' }}>
                                  <div>
                                    <strong>Product Code:</strong> {product.productCode}
                                    {product.fdaClassificationLink && (
                                      <>
                                        {'\u00A0\u00A0\u00A0'}
                                        <a
                                          href={product.fdaClassificationLink}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className={styles.fdaLink}
                                          style={{ fontSize: '12px' }}
                                        >
                                          View FDA Classification
                                        </a>
                                      </>
                                    )}
                                  </div>
                                  {product.deviceName && <div><strong>Device Name:</strong> {product.deviceName}</div>}
                                  {product.regulationNumber && <div><strong>Regulation Number:</strong> 
                                  {'\u00A0'}<a href={`https://www.ecfr.gov/current/title-21/section-${product.regulationNumber}`}
                                   target="_blank" rel="noopener noreferrer" className={styles.fdaLink}
                                  >{product.regulationNumber}</a></div>}
                                  {product.deviceClass && <div><strong>Device Class:</strong> Class {toRoman(product.deviceClass)}</div>}
                                  {product.reason && <div><strong>Reason:</strong> {product.reason}</div>}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )
            })()}
            
            <button 
              className={styles.generateButton}
              onClick={handleGenerateReport}
              disabled={selectedProducts.size === 0 || isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Generate Report'}
            </button>
          </div>
        </div>
      )}

      {/* Generating Step */}
      {currentStep === 'generating' && (
        <div className={styles.message}>
          <div className={styles.messageHeader}>
            <div className={styles.aiAvatar}>
              <img src="/favicon.ico" alt="CiraHealth AI" className={styles.aiAvatarImage} />
            </div>
          </div>
          <div className={styles.messageContent}>
            <div className={styles.loading}>
              ⏳
              {countdown !== null && countdown !== undefined && (
                <span style={{ marginLeft: '8px', fontSize: '14px' }}>
                  {formatCountdown(countdown)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Completed Step */}
      {currentStep === 'completed' && renderCompleted && renderCompleted()}

      <div ref={workflowEndRef} />
    </div>
  )
}
