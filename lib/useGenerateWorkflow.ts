import { useState, useEffect, useRef } from 'react'
import { WorkflowStep, Message, SimilarProduct, Hazard } from './types'

// Mock similar products data
export const similarProducts: SimilarProduct[] = [
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
  const [messageHistory, setMessageHistory] = useState<Message[]>([])
  const workflowEndRef = useRef<HTMLDivElement>(null)

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

    if (onComplete) {
      onComplete(productName, intendedUse, mockHazards)
    } else {
      // Default behavior if no onComplete handler
      addMessage('ai', 'Your PHA Analysis report has been generated successfully!', 'completed')
      setCurrentStep('completed')
    }
  }

  const reset = () => {
    setProductName('')
    setIntendedUse('')
    setCurrentStep('device-name')
    setSelectedProducts(new Set())
    setPreviousSelectedCount(0)
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
    messageHistory,
    workflowEndRef,
    
    // Handlers
    handleDeviceNameSubmit,
    handleIntendedUseAnswer,
    handleIntendedUseSubmit,
    handleSearchProducts,
    handleNewSearch,
    handleRetrySearch,
    handleToggleProduct,
    handleGenerateReport,
    reset
  }
}
