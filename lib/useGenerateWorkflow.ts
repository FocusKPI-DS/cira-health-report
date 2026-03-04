import { useState, useEffect, useRef, useCallback } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { Message, SimilarProduct, Hazard } from './types'
import { analysisApi, AnalysisStatusResponse } from './analysis-api'
import { trackEvent } from './analytics'
import { getAuthHeaders } from './api-utils'
import { getFirebaseAuth } from './firebase'

/** Wait until Firebase has a signed-in user (anonymous or real). */
function waitForAuth(timeoutMs = 10_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const auth = getFirebaseAuth()
    // Already signed in — resolve immediately
    if (auth.currentUser) { resolve(); return }
    const timer = setTimeout(() => {
      unsub()
      reject(new Error('Auth timeout — no Firebase user after ' + timeoutMs + 'ms'))
    }, timeoutMs)
    const unsub = onAuthStateChanged(auth, user => {
      if (user) { clearTimeout(timer); unsub(); resolve() }
    })
  })
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CollectedParams {
  deviceName: string | null
  /** Confirmed product codes after user selects from search results */
  productCodes: string[]
  /** null = not yet asked / addressed; '' = explicitly skipped */
  intendedUse: string | null
  /** Full product objects for the selected codes */
  selectedProducts: SimilarProduct[]
}

export interface SearchResultSet {
  fdaResults: SimilarProduct[]
  aiResults: SimilarProduct[]
  fdaResultsText: string
  aiResultsText: string
}

/** What the /anonclient/chat endpoint returns */
interface ChatResponse {
  message: string
  suggestedOptions: string[]
  action: 'trigger_search' | 'use_product_code' | 'ready_to_start' | null
  extractedParams: {
    deviceName?: string
    /** 3-letter FDA code the user said they already know — bypasses keyword search */
    knownProductCode?: string
    intendedUse?: string
    intendedUseSkipped?: boolean
  }
}

// ─── Options ──────────────────────────────────────────────────────────────────

interface UseGenerateWorkflowOptions {
  initialProductName?: string
  onComplete?: (productName: string, intendedUse: string, hazards: Hazard[], analysisId: string) => void
  onStartSuccess?: (analysisId: string, productName: string, intendedUse: string) => void
  onPaymentRequired?: () => void
  skipPaymentCheck?: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGenerateWorkflow(options: UseGenerateWorkflowOptions = {}) {
  const { initialProductName = '', onComplete, onStartSuccess } = options

  // ── Chat messages displayed in the UI ──
  const [messages, setMessages] = useState<Message[]>([])
  // ── Quick-reply buttons after the last AI message ──
  const [suggestedOptions, setSuggestedOptions] = useState<string[]>([])
  // ── Collected parameters ──
  const [collected, setCollected] = useState<CollectedParams>({
    deviceName: initialProductName || null,
    productCodes: [],
    intendedUse: null,
    selectedProducts: [],
  })
  // ── FDA/AI search results to display as a table widget inside the chat ──
  const [searchResults, setSearchResults] = useState<SearchResultSet | null>(null)
  // ── Whether all required params are ready ──
  const [isReadyToStart, setIsReadyToStart] = useState(false)
  // ── Loading flag while waiting for AI reply or search ──
  const [isLoading, setIsLoading] = useState(false)
  // ── Analysis runtime state ──
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [phase, setPhase] = useState<'chat' | 'generating' | 'completed'>('chat')

  const workflowEndRef = useRef<HTMLDivElement>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const initializedRef = useRef(false)

  // Auto-scroll on new messages
  useEffect(() => {
    workflowEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, searchResults, phase])

  // ── Helper: append a message ──
  const appendMessage = useCallback((type: 'ai' | 'user', content: string) => {
    setMessages(prev => [...prev, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      content,
      timestamp: Date.now(),
    }])
  }, [])

  // ── Initial greeting (once) ──
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    if (initialProductName) {
      // If product name was pre-filled, kick off conversation with it after auth is ready
      appendMessage('user', initialProductName)
      waitForAuth().then(() => {
        callChatApi(
          [{ role: 'user', content: initialProductName }],
          { deviceName: initialProductName, productCodes: [], intendedUse: null, selectedProducts: [] }
        )
      }).catch(err => {
        console.error('[useGenerateWorkflow] Auth wait failed:', err)
        appendMessage('ai', 'Authentication is taking longer than expected. Please refresh the page and try again.')
      })
    } else {
      appendMessage('ai', "Hello! I'm here to help you generate a PHA Analysis. What is the name of your device? If you already know your FDA product code, you can enter it directly — e.g. **KZH**.")
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Core: call /anonclient/chat and handle the response ──
  const callChatApi = useCallback(async (
    msgs: Array<{ role: string; content: string }>,
    currentCollected: CollectedParams
  ) => {
    setIsLoading(true)
    try {
      // Ensure Firebase auth is ready before fetching the token
      await waitForAuth()
      const headers = await getAuthHeaders()
      const response = await fetch(`${API_URL}/api/v1/anonclient/chat`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: msgs,
          collected: {
            deviceName: currentCollected.deviceName,
            productCodes: currentCollected.productCodes,
            intendedUse: currentCollected.intendedUse,
            selectedProducts: currentCollected.selectedProducts,
          },
        }),
      })

      if (!response.ok) {
        let errDetail = ''
        try { const errBody = await response.json(); errDetail = errBody?.detail || JSON.stringify(errBody) } catch {}
        console.error(`[Chat] API error ${response.status}:`, errDetail)
        throw new Error(`${response.status}: ${errDetail || 'Unknown server error'}`)
      }

      const data: ChatResponse = await response.json()
      console.log('[Chat] Response:', data)

      // 1. Apply extracted params
      let updatedCollected = { ...currentCollected }
      if (data.extractedParams?.deviceName) {
        updatedCollected.deviceName = data.extractedParams.deviceName
      }
      if (data.extractedParams?.intendedUse) {
        updatedCollected.intendedUse = data.extractedParams.intendedUse
      }
      if (data.extractedParams?.intendedUseSkipped) {
        updatedCollected.intendedUse = ''  // empty string = skipped
      }

      // 2. Handle action
      if (data.action === 'trigger_search') {
        setCollected(updatedCollected)
        appendMessage('ai', data.message)
        setSuggestedOptions([])
        await performSearch(updatedCollected)
        return
      }

      if (data.action === 'use_product_code') {
        const code = data.extractedParams?.knownProductCode?.toUpperCase()
        if (code) {
          setCollected(updatedCollected)
          appendMessage('ai', data.message)
          setSuggestedOptions([])
          await performSearch(updatedCollected, code)
          return
        }
      }

      if (data.action === 'ready_to_start') {
        setIsReadyToStart(true)
      }

      setCollected(updatedCollected)
      appendMessage('ai', data.message)
      setSuggestedOptions(data.suggestedOptions ?? [])
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[Chat] Error:', msg)
      // Show a useful error if it's a known HTTP error, otherwise generic
      const display = msg.startsWith('401')
        ? 'Authentication failed. Please refresh the page and try again.'
        : msg.startsWith('429')
        ? 'Too many requests. Please wait a moment and try again.'
        : msg.startsWith('5')
        ? `Server error — ${msg}. Please try again.`
        : 'Sorry, something went wrong. Please try again.'
      appendMessage('ai', display)
      setSuggestedOptions([])
    } finally {
      setIsLoading(false)
    }
  }, [appendMessage])

  // ── User sends a message (text input or quick-reply button) ──
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return
    setSuggestedOptions([])
    appendMessage('user', text)

    // Build conversation history for the API (all messages so far + new one)
    const history = messages
      .map(m => ({ role: m.type === 'ai' ? 'assistant' : 'user', content: m.content }))
    history.push({ role: 'user', content: text })

    await callChatApi(history, collected)
  }, [messages, collected, isLoading, appendMessage, callChatApi])

  // ── FDA product search ──
  // Pass knownProductCode to search directly by 3-letter FDA code instead of by device name
  const performSearch = useCallback(async (currentCollected: CollectedParams, knownProductCode?: string) => {
    const deviceName = currentCollected.deviceName
    if (!knownProductCode && !deviceName) return

    setIsLoading(true)
    try {
      const params = knownProductCode
        ? new URLSearchParams({
            search_type: 'product-code',
            productCode: knownProductCode.toUpperCase(),
            limit: '10',
          })
        : new URLSearchParams({
            search_type: 'keywords',
            deviceName: deviceName!,
            limit: '10',
          })
      const res = await fetch(`${API_URL}/api/v1/anonclient/search-fda-products?${params}`)
      if (!res.ok) throw new Error('Search failed')

      const data = await res.json()
      const results: SearchResultSet = {
        fdaResults: data.fda_results ?? [],
        aiResults: data.ai_results ?? [],
        fdaResultsText: data.fda_results_text ?? '',
        aiResultsText: data.ai_results_text ?? '',
      }
      setSearchResults(results)

      const totalFound = results.fdaResults.length + results.aiResults.length
      const searchLabel = knownProductCode ? `product code "${knownProductCode}"` : `"${deviceName}"`
      if (totalFound === 0) {
        appendMessage('ai', `I couldn't find any products for ${searchLabel} in the FDA database. You can try a different ${knownProductCode ? 'code or device name' : 'name'}.`)
      } else {
        appendMessage('ai', `I found ${totalFound} product(s) in the FDA database. Please select the ones that best match your device, then click "Generate Report" when ready.`)
      }
      setSuggestedOptions([])
    } catch (err) {
      console.error('[Search] Error:', err)
      appendMessage('ai', 'The FDA search encountered an error. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [appendMessage])

  // ── User toggles a product row in the search result table ──
  const toggleProduct = useCallback((product: SimilarProduct) => {
    setCollected(prev => {
      const alreadySelected = prev.selectedProducts.some(p => p.id === product.id)
      const newSelected = alreadySelected
        ? prev.selectedProducts.filter(p => p.id !== product.id)
        : [...prev.selectedProducts, product]
      const newCodes = newSelected
        .map(p => p.productCode)
        .filter((c): c is string => Boolean(c))

      // If user now has at least one code selected, mark ready
      if (newCodes.length > 0) {
        setIsReadyToStart(true)
      } else {
        setIsReadyToStart(false)
      }

      // If device name was never collected (user entered code directly), use the
      // first selected product's device name so the analysis has a meaningful title.
      const deviceName = prev.deviceName
        ?? (newSelected[0]?.device || newSelected[0]?.deviceName || null)

      return { ...prev, deviceName, selectedProducts: newSelected, productCodes: newCodes }
    })
  }, [])

  // ── Trigger a new search with a different query ──
  const retrySearch = useCallback(async (newDeviceName: string) => {
    const trimmed = newDeviceName.trim()
    if (!trimmed) return
    appendMessage('user', trimmed)
    setSearchResults(null)
    const updated = { ...collected, deviceName: trimmed }
    setCollected(updated)
    await performSearch(updated)
  }, [collected, appendMessage, performSearch])

  // ── Start analysis generation (called after Generate Report is clicked) ──
  const startAnalysisGeneration = useCallback(async () => {
    if (collected.productCodes.length === 0) {
      alert('Please select at least one product from the search results.')
      return
    }

    const selectedProductData = collected.selectedProducts
    const selectedProductCodes = collected.productCodes

    trackEvent('generate_report', {
      product_name: collected.deviceName || '',
      intended_use: collected.intendedUse || undefined,
      selected_products_count: selectedProductCodes.length,
      product_codes: selectedProductCodes.join(','),
    })

    // Build similar_products payload for backend (matching expected structure)
    const similarProductsForBackend = selectedProductData.map(product => ({
      id: product.id,
      productCode: product.productCode,
      device: product.device || product.deviceName || '',
      deviceClass: product.deviceClass,
      regulationDescription: product.regulationDescription || product.deviceName || '',
      regulationMedicalSpecialty: product.medicalSpecialty || '',
      regulationNumber: product.regulationNumber,
      classificationLink: product.fdaClassificationLink,
      similarity: product.similarity,
      source: product.source || 'FDA',
      ...(product.manufacturer && { manufacturer: product.manufacturer }),
      ...(product.reason && { reason: product.reason }),
    }))

    // If onStartSuccess is provided (results page), use the slim path
    if (onStartSuccess) {
      try {
        const startResult = await analysisApi.startAnalysis(
          selectedProductCodes,
          similarProductsForBackend,
          collected.deviceName || '',
          collected.intendedUse || undefined
        )
        onStartSuccess(startResult.analysis_id, collected.deviceName || '', collected.intendedUse || '')
      } catch (error) {
        console.error('[Analysis] Error starting analysis:', error)
        alert('Failed to start analysis. Please try again.')
      }
      return
    }

    // Generate page: show UI + poll
    setPhase('generating')
    setCountdown(30)
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    countdownIntervalRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 0) {
          if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null }
          return null
        }
        return prev - 1
      })
    }, 1000)

    try {
      const result = await analysisApi.startAnalysisAndPoll(
        selectedProductCodes,
        similarProductsForBackend,
        collected.deviceName || '',
        collected.intendedUse || undefined,
        (status: AnalysisStatusResponse) => {
          console.log('[Analysis] Status:', status.status, status.detail)
        },
        5000
      )

      if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null }
      setCountdown(null)
      setAnalysisId(result.analysisId)
      setPhase('completed')

      if (onComplete) {
        onComplete(collected.deviceName || '', collected.intendedUse || '', [], result.analysisId)
      }
    } catch (error) {
      if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null }
      setCountdown(null)
      console.error('[Analysis] Error:', error)
      setPhase('chat')
      appendMessage('ai', 'An error occurred while generating the analysis. Please try again.')
    }
  }, [collected, onStartSuccess, onComplete, appendMessage])

  // ── Fetch report data after completion ──
  const fetchReportData = useCallback(async (): Promise<Hazard[]> => {
    if (!analysisId) throw new Error('No analysis ID available')
    const response = await analysisApi.getAnalysisResults(analysisId, 1, 100)
    if (!response.results || response.results.length === 0) throw new Error('No hazards found in the analysis')
    return response.results
  }, [analysisId])

  // ── Reset everything ──
  const reset = useCallback(() => {
    setMessages([{
      id: '1',
      type: 'ai',
      content: "Hello! I'm here to help you generate a PHA Analysis. What is the name of your device? If you already know your FDA product code, you can enter it directly — e.g. **KZH**.",
      timestamp: Date.now(),
    }])
    setSuggestedOptions([])
    setCollected({ deviceName: null, productCodes: [], intendedUse: null, selectedProducts: [] })
    setSearchResults(null)
    setIsReadyToStart(false)
    setAnalysisId(null)
    setCountdown(null)
    setPhase('chat')
  }, [])

  return {
    // State
    messages,
    suggestedOptions,
    collected,
    searchResults,
    isReadyToStart,
    isLoading,
    analysisId,
    countdown,
    phase,
    workflowEndRef,

    // Actions
    sendMessage,
    toggleProduct,
    retrySearch,
    startAnalysisGeneration,
    fetchReportData,
    reset,

    // Convenience aliases kept for backward compat with generate/page.tsx
    productName: collected.deviceName || '',
    intendedUse: collected.intendedUse || '',
  }
}


