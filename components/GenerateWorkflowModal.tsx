'use client'

import { useState, useEffect, useRef } from 'react'
import styles from './GenerateWorkflowModal.module.css'

interface SimilarProduct {
  id: string
  productCode: string
  device: string
  regulationDescription: string
  medicalSpecialty: string
  fdaClassificationLink?: string
}

interface Hazard {
  hazard: string
  potentialHarm: string
  severity: string[]
}

type WorkflowStep = 'device-name' | 'intended-use-question' | 'intended-use-input' | 'searching-products' | 'similar-products' | 'no-products-found' | 'product-selection' | 'generating' | 'completed'

interface Message {
  id: string
  type: 'ai' | 'user'
  content: string
  step?: WorkflowStep
  timestamp: number
}

interface GenerateWorkflowModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete?: (productName: string, intendedUse: string, hazards: Hazard[]) => void
}

export default function GenerateWorkflowModal({ isOpen, onClose, onComplete }: GenerateWorkflowModalProps) {
  const [productName, setProductName] = useState('')
  const [intendedUse, setIntendedUse] = useState('')
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('device-name')
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [previousSelectedCount, setPreviousSelectedCount] = useState(0)
  const [productsFound, setProductsFound] = useState(true)
  const [messageHistory, setMessageHistory] = useState<Message[]>([])
  const workflowEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      // Reset state when modal opens
      setProductName('')
      setIntendedUse('')
      setCurrentStep('device-name')
      setSelectedProducts(new Set())
      setPreviousSelectedCount(0)
      setProductsFound(true)
      setMessageHistory([{
        id: '1',
        type: 'ai',
        content: `Hello! I'm here to help you generate a PHA Analysis. What is the name of your device?`,
        step: 'device-name',
        timestamp: Date.now()
      }])
    }
  }, [isOpen])

  useEffect(() => {
    // Scroll to bottom when new messages are added
    workflowEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messageHistory, currentStep])

  // Mock similar products data
  const similarProducts: SimilarProduct[] = [
    {
      id: '1',
      productCode: 'FMF',
      device: 'Syringe, Piston',
      regulationDescription: 'Syringe, Piston',
      medicalSpecialty: 'General Hospital',
      fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=880.5860'
    },
    {
      id: '2',
      productCode: 'MEG',
      device: 'Syringe, Antistick',
      regulationDescription: 'Syringe, Antistick',
      medicalSpecialty: 'General Hospital',
      fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=880.5860'
    },
    {
      id: '3',
      productCode: 'FRN',
      device: 'Pump, Infusion',
      regulationDescription: 'Pump, Infusion',
      medicalSpecialty: 'General Hospital',
      fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=880.5860'
    },
    {
      id: '4',
      productCode: 'DXT',
      device: 'Injector And Syringe, Angiographic',
      regulationDescription: 'Injector And Syringe, Angiographic',
      medicalSpecialty: 'Cardiovascular',
      fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=880.5860'
    },
    {
      id: '5',
      productCode: 'GAA',
      device: 'Syringe, Disposable',
      regulationDescription: 'Syringe, Disposable',
      medicalSpecialty: 'General Hospital',
      fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=880.5860'
    }
  ]

  const addMessage = (type: 'ai' | 'user', content: string, step?: WorkflowStep) => {
    setMessageHistory(prev => [...prev, {
      id: Date.now().toString(),
      type,
      content,
      step,
      timestamp: Date.now()
    }])
  }

  const handleDeviceNameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!productName.trim()) {
      return
    }
    addMessage('user', productName, 'device-name')
    addMessage('ai', `Thank you! Your device name is **${productName}**.`, 'intended-use-question')
    setCurrentStep('intended-use-question')
  }

  const handleIntendedUseAnswer = (hasIntendedUse: boolean) => {
    addMessage('user', hasIntendedUse ? 'Yes' : 'No', 'intended-use-question')
    if (hasIntendedUse) {
      addMessage('ai', 'Please describe the intended use of your device:', 'intended-use-input')
      setCurrentStep('intended-use-input')
    } else {
      handleSearchProducts()
    }
  }

  const handleIntendedUseSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!intendedUse.trim()) {
      return
    }
    addMessage('user', intendedUse, 'intended-use-input')
    handleSearchProducts()
  }

  const handleSearchProducts = async () => {
    setCurrentStep('searching-products')
    addMessage('ai', 'First, I\'ll search for similar products in the FDA product classification database...', 'searching-products')
    
    // Simulate search delay
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // For demo: alternate between found and not found
    const found = !productsFound
    setProductsFound(found)
    
    if (found) {
      addMessage('ai', 'Following are the products I could find. Please select the ones that fit the best:', 'similar-products')
      setCurrentStep('similar-products')
    } else {
      addMessage('ai', `I couldn't find similar products for "**${productName}**". Could you try modifying the product name? It usually needs to be a bit more general (e.g., instead of "XYZ Model 123 Syringe", try "Syringe" or "Medical Syringe").`, 'no-products-found')
      setCurrentStep('no-products-found')
    }
  }

  const handleNewSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const newDeviceName = (e.target as HTMLFormElement).querySelector('input')?.value || productName
    if (!newDeviceName.trim()) {
      return
    }
    
    setProductName(newDeviceName)
    setSelectedProducts(new Set())
    setPreviousSelectedCount(0)
    addMessage('user', newDeviceName, 'similar-products')
    setCurrentStep('searching-products')
    addMessage('ai', 'First, I\'ll search for similar products in the FDA product classification database...', 'searching-products')
    
    // Simulate search delay
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // For demo: alternate between found and not found
    const found = !productsFound
    setProductsFound(found)
    
    if (found) {
      addMessage('ai', 'Following are the products I could find. Please select the ones that fit the best:', 'similar-products')
      setCurrentStep('similar-products')
    } else {
      addMessage('ai', `I couldn't find similar products for "**${newDeviceName}**". Could you try modifying the product name? It usually needs to be a bit more general (e.g., instead of "XYZ Model 123 Syringe", try "Syringe" or "Medical Syringe").`, 'no-products-found')
      setCurrentStep('no-products-found')
    }
  }

  const handleRetrySearch = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
    }
    if (!productName.trim()) {
      return
    }
    addMessage('user', productName, 'no-products-found')
    await handleSearchProducts()
  }

  const handleToggleProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts)
    if (newSelected.has(productId)) {
      newSelected.delete(productId)
    } else {
      newSelected.add(productId)
    }
    setSelectedProducts(newSelected)
    
    // Add confirmation message when products are selected
    if (newSelected.size > 0 && (previousSelectedCount === 0 || newSelected.size !== previousSelectedCount)) {
      const selectedProductCodes = Array.from(newSelected)
        .map(id => {
          const product = similarProducts.find(p => p.id === id)
          return product?.productCode
        })
        .filter(Boolean)
        .join(', ')
      
      // Remove any previous selection messages
      setMessageHistory(prev => prev.filter(msg => msg.step !== 'product-selection'))
      
      addMessage('user', `Selected: ${selectedProductCodes}`, 'product-selection')
    }
    setPreviousSelectedCount(newSelected.size)
  }

  const handleGenerateReport = async () => {
    if (selectedProducts.size === 0) {
      alert('Please select at least one product')
      return
    }
    
    setCurrentStep('generating')
    addMessage('ai', 'Generating your PHA Analysis report... This may take a few moments.', 'generating')

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Mock report data
    const mockHazards: Hazard[] = [
      {
        hazard: 'Crack',
        potentialHarm: 'Insufficient Information',
        severity: ['Minor', 'Negligible']
      },
      {
        hazard: 'No Clinical Signs, Symptoms or Conditions',
        potentialHarm: 'Insufficient Information',
        severity: ['Minor', 'Negligible']
      },
      {
        hazard: 'No Patient Involvement',
        potentialHarm: 'Insufficient Information',
        severity: ['Minor', 'Negligible']
      },
      {
        hazard: 'No Consequences Or Impact To Patient',
        potentialHarm: 'Insufficient Information',
        severity: ['Negligible']
      },
      {
        hazard: 'No Known Impact Or Consequence To Patient',
        potentialHarm: 'Insufficient Information',
        severity: ['Minor', 'Negligible']
      },
      {
        hazard: 'Battery Malfunction',
        potentialHarm: 'Device Failure',
        severity: ['Moderate']
      },
      {
        hazard: 'Software Error',
        potentialHarm: 'Incorrect Data Display',
        severity: ['Minor', 'Moderate']
      },
      {
        hazard: 'Electrical Hazard',
        potentialHarm: 'Patient Shock Risk',
        severity: ['Critical']
      }
    ]

    // Skip preview, directly call onComplete to go to full report
    if (onComplete) {
      onComplete(productName, intendedUse, mockHazards)
    }
  }

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

  if (!isOpen) return null

  return (
    <>
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <button className={styles.closeButton} onClick={onClose}>
            ×
          </button>
          
          <div className={styles.workflow}>
            {messageHistory.map((message) => (
              <div key={message.id} className={styles.message}>
                <div className={styles.messageHeader}>
                  {message.type === 'ai' && <div className={styles.aiAvatar}>CA</div>}
                  {message.type === 'user' && <div className={styles.userAvatar}>Y</div>}
                </div>
                <div className={`${styles.messageContent} ${message.type === 'user' ? styles.userMessage : ''}`}>
                  {renderMessageContent(message)}
                </div>
              </div>
            ))}

            {/* Device Name Step */}
            {currentStep === 'device-name' && (
              <div className={styles.message}>
                <div className={styles.messageHeader}>
                  <div className={styles.aiAvatar}>CA</div>
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
                  <div className={styles.aiAvatar}>CA</div>
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
                  <div className={styles.aiAvatar}>CA</div>
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
                  <div className={styles.aiAvatar}>CA</div>
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
                  <div className={styles.aiAvatar}>CA</div>
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
                  <div className={styles.aiAvatar}>CA</div>
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
                        {similarProducts.map((product) => (
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
                  <button 
                    className={styles.generateButton}
                    onClick={handleGenerateReport}
                    disabled={selectedProducts.size === 0}
                  >
                    Generate Report
                  </button>
                </div>
              </div>
            )}

            {/* Generating Step */}
            {currentStep === 'generating' && (
              <div className={styles.message}>
                <div className={styles.messageHeader}>
                  <div className={styles.aiAvatar}>CA</div>
                </div>
                <div className={styles.messageContent}>
                  <div className={styles.loading}>⏳</div>
                </div>
              </div>
            )}

            <div ref={workflowEndRef} />
          </div>
        </div>
      </div>
    </>
  )
}
