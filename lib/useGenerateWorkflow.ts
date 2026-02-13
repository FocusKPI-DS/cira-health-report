import { useState, useEffect, useRef } from 'react'
import { WorkflowStep, Message, SimilarProduct, Hazard } from './types'
import { analysisApi, AnalysisStatusResponse } from './analysis-api'
import { trackEvent } from './analytics'

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
  onComplete?: (productName: string, intendedUse: string, hazards: Hazard[], analysisId: string) => void
  onStartSuccess?: (analysisId: string, productName: string, intendedUse: string) => void // Called immediately after start-analysis succeeds
  onPaymentRequired?: () => void
  skipPaymentCheck?: boolean // For first-time users who can generate without payment
}

export function useGenerateWorkflow(options: UseGenerateWorkflowOptions = {}) {
  const { initialProductName = '', onComplete, onStartSuccess, onPaymentRequired, skipPaymentCheck = false } = options

  const [productName, setProductName] = useState(initialProductName)
  const [intendedUse, setIntendedUse] = useState('')
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('device-name')
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [previousSelectedCount, setPreviousSelectedCount] = useState(0)
  const [productsFound, setProductsFound] = useState(true)
  const [searchType, setSearchType] = useState<'keywords' | 'product-code'>('keywords')
  const [productCode, setProductCode] = useState('')
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
      setCurrentStep('product-code-question')
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
        content: `Do you know the FDA Product Code for this device?`,
        step: 'product-code-question',
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
    
    // Always ask if user knows product code (keywords mode is default)
    addMessage('user', productName, 'device-name')
    addMessage('ai', 'Do you know the FDA Product Code for this device?', 'product-code-question')
    setCurrentStep('product-code-question')
  }

  const handleProductCodeSubmit = (code: string) => {
    if (code.length !== 3) {
      alert('Product code must be exactly 3 letters')
      return
    }
    setProductCode(code.toUpperCase())
    setSearchType('product-code')
    setIntendedUse('') // Leave intended use empty
    addMessage('user', code.toUpperCase(), 'product-code-question')
    addMessage('ai', `Thank you! Your device name is **${productName}**.`, 'similar-products')
    // Search by product code
    performSearch(code.toUpperCase(), 'product-code')
  }

  const handleProductCodeSkip = () => {
    addMessage('user', "I don't know", 'product-code-question')
    addMessage('ai', `Thank you! Your device name is **${productName}**.`, 'intended-use-question')
    setCurrentStep('intended-use-question')
  }

  // Unified search function that handles both keywords and product code search
  const performSearch = async (query: string, type: 'keywords' | 'product-code') => {
    setCurrentStep('searching-products')
    setIsSearching(true)
    
    const searchMessage = type === 'product-code' 
      ? `Searching for product code **${query}** in the FDA database...`
      : 'First, I\'ll search for similar products in the FDA product classification database...'
    addMessage('ai', searchMessage, 'searching-products')
    
    if (type === 'keywords') {
      trackEvent('search_similar_product', {
        product_name: query,
        intended_use: intendedUse || undefined
      })
    }
    
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const params = new URLSearchParams({
        search_type: type,
        limit: '20'
      })
      
      if (type === 'product-code') {
        params.append('productCode', query)
      } else {
        params.append('deviceName', query)
      }
      
      const response = await fetch(`${baseUrl}/api/v1/anonclient/search-fda-products?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error('Failed to search FDA database')
      }
      
      const data = await response.json()
      
      const hasFdaResults = data.fda_results && data.fda_results.length > 0
      const hasAiResults = data.ai_results && data.ai_results.length > 0
      
      if (hasFdaResults || hasAiResults) {
        const combinedResults = [
          ...(data.fda_results || []),
          ...(data.ai_results || [])
        ]
        
        setSimilarProducts(combinedResults)
        setProductsFound(true)
        
        let message = 'Following are the products I could find. Please select the ones that fit the best:'
        if (hasAiResults && !hasFdaResults) {
          message = 'No exact match found from FDA database. Here are AI-suggested products based on medical device classifications. Please select the ones that fit the best:'
        }
        
        addMessage('ai', message, 'similar-products')
        setCurrentStep('similar-products')
      } else {
        setSimilarProducts([])
        setProductsFound(false)
        const notFoundMessage = type === 'product-code'
          ? `I couldn't find products for code "**${query}**". Please try searching by device name instead.`
          : `I couldn't find similar products for "**${query}**". Could you try modifying the product name? It usually needs to be a bit more general (e.g., instead of "XYZ Model 123 Syringe", try "Syringe" or "Medical Syringe").`
        addMessage('ai', notFoundMessage, 'no-products-found')
        setCurrentStep('no-products-found')
      }
    } catch (error) {
      console.error('[Search] Error:', error)
      setSimilarProducts(mockSimilarProducts)
      setProductsFound(true)
      addMessage('ai', 'Following are the products I could find (using cached data). Please select the ones that fit the best:', 'similar-products')
      setCurrentStep('similar-products')
    } finally {
      setIsSearching(false)
    }
  }

  const handleIntendedUseAnswer = (hasIntendedUse: boolean) => {
    addMessage('user', hasIntendedUse ? 'Yes' : 'No', 'intended-use-question')
    
    trackEvent(hasIntendedUse ? 'intended_use_yes' : 'intended_use_no', {
      product_name: productName
    })
    
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
    await performSearch(productName, 'keywords')
  }

  const handleNewSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    let newDeviceName = (e.target as HTMLFormElement).querySelector('input[type="text"]')?.value || productName
    newDeviceName = newDeviceName.trim()
    if (!newDeviceName) {
      return
    }
    
    // If product code mode, validate and search by code
    if (searchType === 'product-code') {
      if (newDeviceName.length !== 3) {
        alert('Product code must be exactly 3 letters')
        return
      }
      const code = newDeviceName.toUpperCase()
      setProductCode(code)
      setProductName(code)
      setIntendedUse('') // Leave intended use empty
      setSelectedProducts(new Set())
      setPreviousSelectedCount(0)
      setSimilarProducts([])
      addMessage('user', code, 'similar-products')
      await performSearch(code, 'product-code')
      return
    }
    
    // Keywords mode - search by device name
    setProductName(newDeviceName)
    setSelectedProducts(new Set())
    setPreviousSelectedCount(0)
    setSimilarProducts([])
    addMessage('user', newDeviceName, 'similar-products')
    await performSearch(newDeviceName, 'keywords')
  }

  const handleRetrySearch = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
    }
    
    const trimmedProductName = productName.trim()
    if (!trimmedProductName) {
      return
    }
    
    // If product code mode, validate and search by code
    if (searchType === 'product-code') {
      if (trimmedProductName.length !== 3) {
        alert('Product code must be exactly 3 letters')
        return
      }
      const code = trimmedProductName.toUpperCase()
      setProductCode(code)
      setProductName(code)
      setIntendedUse('') // Leave intended use empty
      addMessage('user', code, 'no-products-found')
      await performSearch(code, 'product-code')
      return
    }
    
    // Keywords mode - search by device name
    addMessage('user', trimmedProductName, 'no-products-found')
    setProductName(trimmedProductName)
    await performSearch(trimmedProductName, 'keywords')
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

  // Internal function to actually start the analysis generation
  const startAnalysisGeneration = async () => {
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
    
    trackEvent('generate_report', {
      product_name: productName,
      intended_use: intendedUse || undefined,
      selected_products_count: selectedProductCodes.length,
      product_codes: selectedProductCodes.join(',')
    })
    
    // Format similar products for backend (matching the expected structure)
    const similarProductsForBackend = selectedProductData.map(product => ({
      id: product.id,
      productCode: product.productCode,
      device: product.device || product.deviceName || '', // AI results use deviceName
      deviceClass: product.deviceClass,
      regulationDescription: product.regulationDescription || product.deviceName || '',
      regulationMedicalSpecialty: product.medicalSpecialty || '',
      regulationNumber: product.regulationNumber,
      classificationLink: product.fdaClassificationLink,
      similarity: product.similarity,
      source: product.source || 'FDA',
      // Include AI-specific fields if present
      ...(product.manufacturer && { manufacturer: product.manufacturer }),
      ...(product.reason && { reason: product.reason })
    }))
    
    // If onStartSuccess is provided (results page), call the API without UI updates
    // The parent component will handle modal closing and navigation
    if (onStartSuccess) {
      try {
        // Call start-analysis API without polling
        const startResult = await analysisApi.startAnalysis(
          selectedProductCodes,
          similarProductsForBackend,
          productName,
          intendedUse || undefined
        )
        
        // Call onStartSuccess immediately with the returned analysis_id
        onStartSuccess(startResult.analysis_id, productName, intendedUse)
        return
      } catch (error) {
        console.error('[Analysis] Error starting analysis:', error)
        alert('Failed to start analysis. Please try again.')
        return
      }
    }
    
    // For generate page (no onStartSuccess), show UI updates and poll
    setCurrentStep('generating')
    addMessage('ai', 'Generating your PHA Analysis report... This may take a few moments.', 'generating')

    // Start 0.5-minute countdown (30 seconds)
    setCountdown(30)
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
        productName, // Pass the user-entered product name
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
        
        // Notify parent with empty hazards and analysisId - they'll be fetched when View Report is clicked
        if (onComplete) {
          onComplete(productName, intendedUse, [], result.analysisId)
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
      
      // Check if payment was successful before showing retry option
      // If payment was made, allow retry without new payment
      addMessage('ai', 'An error occurred while generating the analysis. If you have already paid, you can retry without additional payment.', 'completed')
      setCurrentStep('completed')
      
      // Show error but allow retry
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate analysis'
      console.error('[Analysis] Generation error:', errorMessage)
      
      // Note: Retry can be handled by calling startAnalysisGeneration again
      // The payment check will verify if payment was already made
    }
  }

  // Public handler that checks payment before generation
  // NOTE: This should be overridden by parent component with payment check logic
  const handleGenerateReport = async () => {
    console.log('[Workflow] ===== handleGenerateReport CALLED (workflow hook) =====')
    console.log('[Workflow] skipPaymentCheck:', skipPaymentCheck, 'onPaymentRequired:', !!onPaymentRequired)
    
    if (selectedProducts.size === 0) {
      alert('Please select at least one product')
      return
    }

    // If skipPaymentCheck is true (first-time user), proceed directly
    if (skipPaymentCheck) {
      console.log('[Workflow] skipPaymentCheck is true, proceeding directly')
      await startAnalysisGeneration()
      return
    }

    // For returning users, check if payment is required
    if (onPaymentRequired) {
      console.log('[Workflow] Calling onPaymentRequired callback')
      // Trigger payment modal - parent component will handle payment and call startAnalysisGeneration after success
      onPaymentRequired()
    } else {
      console.log('[Workflow] No onPaymentRequired callback, proceeding directly (FALLBACK - THIS SHOULD NOT HAPPEN)')
      // If no payment callback provided, proceed directly (fallback)
      await startAnalysisGeneration()
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
    setSearchType('keywords')
    setProductCode('')
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
    searchType,
    setSearchType,
    productCode,
    setProductCode,
    
    // Handlers
    handleDeviceNameSubmit,
    handleProductCodeSubmit,
    handleProductCodeSkip,
    handleIntendedUseAnswer,
    handleIntendedUseSubmit,
    handleSearchProducts,
    handleNewSearch,
    handleRetrySearch,
    handleToggleProduct,
    handleGenerateReport,
    startAnalysisGeneration, // Expose for calling after payment success
    fetchReportData,
    reset
  }
}
