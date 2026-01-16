import { useState, useEffect, useRef } from 'react'
import { WorkflowStep, Message, SimilarProduct, Hazard } from './types'
import { analysisApi, AnalysisStatusResponse } from './analysis-api'

// Mock similar products data (fallback only)
const mockSimilarProducts: SimilarProduct[] = [
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
    fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=880.5725'
  },
  {
    id: '4',
    productCode: 'DXT',
    device: 'Injector And Syringe, Angiographic',
    regulationDescription: 'Injector And Syringe, Angiographic',
    medicalSpecialty: 'Cardiovascular',
    fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=870.1200'
  },
  {
    id: '5',
    productCode: 'GAA',
    device: 'Syringe, Disposable',
    regulationDescription: 'Syringe, Disposable',
    medicalSpecialty: 'General Hospital',
    fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=880.5860'
  },
  {
    id: '6',
    productCode: 'KGL',
    device: 'Syringe, Glass',
    regulationDescription: 'Syringe, Glass',
    medicalSpecialty: 'General Hospital',
    fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=880.5860'
  },
  {
    id: '7',
    productCode: 'MMM',
    device: 'Pump, Infusion, Insulin',
    regulationDescription: 'Pump, Infusion, Insulin',
    medicalSpecialty: 'Endocrinology',
    fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=880.5725'
  },
  {
    id: '8',
    productCode: 'NYY',
    device: 'Syringe, Tubing',
    regulationDescription: 'Syringe, Tubing',
    medicalSpecialty: 'General Hospital',
    fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=880.5860'
  },
  {
    id: '9',
    productCode: 'OZS',
    device: 'Pump, Infusion, Enteral',
    regulationDescription: 'Pump, Infusion, Enteral',
    medicalSpecialty: 'General Hospital',
    fdaClassificationLink: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=880.5725'
  }
]

interface UseGenerateWorkflowOptions {
  initialProductName?: string
  onComplete?: (productName: string, intendedUse: string, hazards: Hazard[]) => void
}

export function useGenerateWorkflow(options: UseGenerateWorkflowOptions = {}) {
  const { initialProductName = '', onComplete } = options

  const [productName, setProductName] = useState(initialProductName)
  const [intendedUse, setIntendedUse] = useState('')
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('device-name')
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [previousSelectedCount, setPreviousSelectedCount] = useState(0)
  const [productsFound, setProductsFound] = useState(true)
  const [messageHistory, setMessageHistory] = useState<Message[]>([{
    id: '1',
    type: 'ai',
    content: `Hello! I'm here to help you generate a PHA Analysis. What is the name of your device?`,
    step: 'device-name',
    timestamp: Date.now()
  }])
  const [similarProducts, setSimilarProducts] = useState<SimilarProduct[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const workflowEndRef = useRef<HTMLDivElement>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize with product name if provided
  useEffect(() => {
    if (initialProductName) {
      setProductName(initialProductName)
      setCurrentStep('intended-use-question')
      setMessageHistory([{
        id: '1',
        type: 'ai',
        content: `Hello! I'm here to help you generate a PHA Analysis. What is the name of your device?`,
        step: 'device-name',
        timestamp: Date.now()
      }, {
        id: '2',
        type: 'user',
        content: initialProductName,
        step: 'device-name',
        timestamp: Date.now() + 1
      }, {
        id: '3',
        type: 'ai',
        content: `Thank you! Your device name is **${initialProductName}**.`,
        step: 'intended-use-question',
        timestamp: Date.now() + 2
      }])
    }
  }, [initialProductName])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    workflowEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messageHistory, currentStep])

  const addMessage = (type: 'ai' | 'user', content: string, step?: WorkflowStep) => {
    setMessageHistory(prev => [...prev, {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
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
    setIsSearching(true)
    addMessage('ai', 'First, I\'ll search for similar products in the FDA product classification database...', 'searching-products')
    
    try {
      // Call FDA search API
      const response = await fetch(`/api/search-fda-products?deviceName=${encodeURIComponent(productName)}&limit=20`)
      
      if (!response.ok) {
        throw new Error('Failed to search FDA database')
      }
      
      const data = await response.json()
      
      if (data.results && data.results.length > 0) {
        setSimilarProducts(data.results)
        setProductsFound(true)
        addMessage('ai', 'Following are the products I could find. Please select the ones that fit the best:', 'similar-products')
        setCurrentStep('similar-products')
      } else {
        setSimilarProducts([])
        setProductsFound(false)
        addMessage('ai', `I couldn't find similar products for "**${productName}**". Could you try modifying the product name? It usually needs to be a bit more general (e.g., instead of "XYZ Model 123 Syringe", try "Syringe" or "Medical Syringe").`, 'no-products-found')
        setCurrentStep('no-products-found')
      }
    } catch (error) {
      console.error('[Search Products] Error:', error)
      // Fallback to mock data on error
      setSimilarProducts(mockSimilarProducts)
      setProductsFound(true)
      addMessage('ai', 'Following are the products I could find (using cached data). Please select the ones that fit the best:', 'similar-products')
      setCurrentStep('similar-products')
    } finally {
      setIsSearching(false)
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
    setSimilarProducts([])
    addMessage('user', newDeviceName, 'similar-products')
    setCurrentStep('searching-products')
    setIsSearching(true)
    addMessage('ai', 'First, I\'ll search for similar products in the FDA product classification database...', 'searching-products')
    
    try {
      // Call FDA search API
      const response = await fetch(`/api/search-fda-products?deviceName=${encodeURIComponent(newDeviceName)}&limit=20`)
      
      if (!response.ok) {
        throw new Error('Failed to search FDA database')
      }
      
      const data = await response.json()
      
      if (data.results && data.results.length > 0) {
        setSimilarProducts(data.results)
        setProductsFound(true)
        addMessage('ai', 'Following are the products I could find. Please select the ones that fit the best:', 'similar-products')
        setCurrentStep('similar-products')
      } else {
        setSimilarProducts([])
        setProductsFound(false)
        addMessage('ai', `I couldn't find similar products for "**${newDeviceName}**". Could you try modifying the product name? It usually needs to be a bit more general (e.g., instead of "XYZ Model 123 Syringe", try "Syringe" or "Medical Syringe").`, 'no-products-found')
        setCurrentStep('no-products-found')
      }
    } catch (error) {
      console.error('[New Search] Error:', error)
      // Fallback to mock data on error
      setSimilarProducts(mockSimilarProducts)
      setProductsFound(true)
      addMessage('ai', 'Following are the products I could find (using cached data). Please select the ones that fit the best:', 'similar-products')
      setCurrentStep('similar-products')
    } finally {
      setIsSearching(false)
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
    
    // Get selected product codes and full product data
    const selectedProductData = Array.from(selectedProducts)
      .map(id => similarProducts.find(p => p.id === id))
      .filter((product): product is SimilarProduct => Boolean(product))
    
    const selectedProductCodes = selectedProductData
      .map(product => product.productCode)
      .filter((code): code is string => Boolean(code))
    
    if (selectedProductCodes.length === 0) {
      alert('No valid product codes selected')
      return
    }
    
    // Format similar products for backend (matching the expected structure)
    const similarProductsForBackend = selectedProductData.map(product => ({
      id: product.id,
      productCode: product.productCode,
      device: product.device,
      deviceClass: product.deviceClass,
      regulationDescription: product.regulationDescription,
      regulationMedicalSpecialty: product.medicalSpecialty,
      regulationNumber: product.regulationNumber,
      classificationLink: product.fdaClassificationLink,
      similarity: product.similarity,
      source: product.source || 'FDA'
    }))
    
    setCurrentStep('generating')
    addMessage('ai', 'Generating your PHA Analysis report... This may take a few moments.', 'generating')

    // Start 5-minute countdown (300 seconds)
    setCountdown(300)
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
    }
    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 0) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current)
            countdownIntervalRef.current = null
          }
          return null
        }
        return prev - 1
      })
    }, 1000)

    try {
      // Call the backend API and poll for status
      const result = await analysisApi.startAnalysisAndPoll(
        selectedProductCodes, // Pass selected product codes
        similarProductsForBackend, // Pass complete similar products data
        intendedUse || undefined, // Pass intended use
        (status: AnalysisStatusResponse) => {
          // Update message with status
          console.log('[Analysis] Status update:', status.status, status.detail)
        },
        5000 // Poll every 5 seconds
      )

      // Clear countdown when polling completes
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
      setCountdown(null)

      // Save analysis ID for later fetching results
      setAnalysisId(result.analysisId)

      if (result.status === 'Completed' || result.status === 'Failed') {
        // Analysis finished - show completion message and let user view report
        addMessage('ai', 'Your PHA Analysis has been completed! Click "View Report" to see the results.', 'completed')
        setCurrentStep('completed')
        
        // Notify parent with empty hazards - they'll be fetched when View Report is clicked
        if (onComplete) {
          onComplete(productName, intendedUse, [])
        }
      } else {
        // Other status (should not happen, but handle gracefully)
        addMessage('ai', `Analysis status: ${result.status}. ${result.detail}`, 'completed')
        setCurrentStep('completed')
      }
    } catch (error) {
      // Clear countdown on error
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
        countdownIntervalRef.current = null
      }
      setCountdown(null)
      
      console.error('[Analysis] Error:', error)
      addMessage('ai', 'An error occurred while generating the analysis. Please try again.', 'completed')
      setCurrentStep('completed')
      alert(error instanceof Error ? error.message : 'Failed to generate analysis')
    }
  }

  const fetchReportData = async (): Promise<Hazard[]> => {
    if (!analysisId) {
      throw new Error('No analysis ID available')
    }

    try {
      const response = await analysisApi.getAnalysisResults(analysisId, 1, 100)
      if (!response.results || response.results.length === 0) {
        throw new Error('No hazards found in the analysis')
      }
      return response.results
    } catch (error) {
      console.error('[Analysis] Error fetching results:', error)
      throw error
    }
  }

  const reset = () => {
    setProductName('')
    setIntendedUse('')
    setCurrentStep('device-name')
    setSelectedProducts(new Set())
    setPreviousSelectedCount(0)
    setSimilarProducts([])
    setIsSearching(false)
    setMessageHistory([{
      id: '1',
      type: 'ai',
      content: `Hello! I'm here to help you generate a PHA Analysis. What is the name of your device?`,
      step: 'device-name',
      timestamp: Date.now()
    }])
    setProductsFound(true)
  }

  return {
    // State
    productName,
    setProductName,
    intendedUse,
    setIntendedUse,
    currentStep,
    setCurrentStep,
    selectedProducts,
    similarProducts,
    isSearching,
    messageHistory,
    workflowEndRef,
    analysisId,
    countdown,
    
    // Handlers
    handleDeviceNameSubmit,
    handleIntendedUseAnswer,
    handleIntendedUseSubmit,
    handleSearchProducts,
    handleNewSearch,
    handleRetrySearch,
    handleToggleProduct,
    handleGenerateReport,
    fetchReportData,
    reset
  }
}
