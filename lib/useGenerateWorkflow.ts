import { useState, useEffect, useRef, useCallback } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import {
  Message, SimilarProduct, Hazard, SearchResultSet,
  AgentAction, AgentHistoryMessage, AgentResponse,
  ShowProductsAction, StartAnalysisAction,
} from './types'
import { analysisApi, AnalysisStatusResponse } from './analysis-api'
import { trackEvent } from './analytics'
import { getAuthHeaders } from './api-utils'
import { getFirebaseAuth } from './firebase'

/** Wait until Firebase has a signed-in user (anonymous or real). */
function waitForAuth(timeoutMs = 10_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const auth = getFirebaseAuth()
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
  productCodes: string[]
  /** null = not yet asked; '' = explicitly skipped */
  intendedUse: string | null
  selectedProducts: SimilarProduct[]
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
  // ── Latest search results ID — used to detect the newest search message ──
  const [latestSearchMsgId, setLatestSearchMsgId] = useState<string | null>(null)
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
  }, [messages, latestSearchMsgId, phase])

  // ── Helper: append a message, optionally with embedded search results ──
  const appendMessage = useCallback((
    type: 'ai' | 'user',
    content: string,
    searchResultSet?: SearchResultSet,
  ) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setMessages(prev => [...prev, {
      id,
      type,
      content,
      timestamp: Date.now(),
      ...(searchResultSet ? { searchResultSet } : {}),
    }])
    if (searchResultSet) setLatestSearchMsgId(id)
    return id
  }, [])

  // ── Initial greeting (once) ──
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    if (initialProductName) {
      // Product name was pre-filled (e.g. via ?productName=). Show a greeting and
      // wait for the user to confirm — don't fire the API automatically.
      appendMessage('ai', `I'm ready to help you generate a PHA Analysis for **${initialProductName}**. Press Send to search for matching FDA products, or type a different device name or product code.`)
    } else {
      appendMessage('ai', "Hello! I'm here to help you generate a PHA Analysis. What is the name of your device? If you already know your FDA product code, you can enter it directly — e.g. **KZH**.")
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Agent history (internal, sent to /agent endpoint) ──────────────────────
  const [agentHistory, setAgentHistory] = useState<AgentHistoryMessage[]>([])
  // Use a ref alongside state so callbacks always see the latest value without
  // needing it as a dependency (avoids stale-closure issues in async functions).
  const agentHistoryRef = useRef<AgentHistoryMessage[]>([])

  const pushHistory = useCallback((msgs: AgentHistoryMessage[]) => {
    agentHistoryRef.current = msgs
    setAgentHistory(msgs)
  }, [])

  // ─── startAnalysisGenerationWith — unchanged execution logic ─────────────────
  const startAnalysisGenerationWith = useCallback(async (data: CollectedParams) => {
    if (data.productCodes.length === 0) return

    const similarProductsForBackend = data.selectedProducts.map(product => ({
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

    if (onStartSuccess) {
      try {
        const startResult = await analysisApi.startAnalysis(
          data.productCodes,
          similarProductsForBackend,
          data.deviceName || '',
          data.intendedUse || undefined,
        )
        onStartSuccess(startResult.analysis_id, data.deviceName || '', data.intendedUse || '')
      } catch (error) {
        console.error('[Analysis] Error starting analysis:', error)
        appendMessage('ai', 'Failed to start analysis. Please try again.')
      }
      return
    }

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
        data.productCodes,
        similarProductsForBackend,
        data.deviceName || '',
        data.intendedUse || undefined,
        (status: AnalysisStatusResponse) => {
          console.log('[Analysis] Status:', status.status, status.detail)
        },
        5000,
      )
      if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null }
      setCountdown(null)
      setAnalysisId(result.analysisId)
      setPhase('completed')
      if (onComplete) onComplete(data.deviceName || '', data.intendedUse || '', [], result.analysisId)
    } catch (error) {
      if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null }
      setCountdown(null)
      console.error('[Analysis] Error:', error)
      setPhase('chat')
      appendMessage('ai', 'An error occurred while generating the analysis. Please try again.')
    }
  }, [onStartSuccess, onComplete, appendMessage]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Handle the action returned by the agent ─────────────────────────────────
  // selectedProductsRef lets handleAction read the latest selected products without
  // adding them as a useCallback dependency (would cause a re-render loop).
  const selectedProductsRef = useRef<SimilarProduct[]>([])

  const handleAction = useCallback(async (action: AgentAction) => {
    switch (action.type) {
      case 'ask':
      case 'message': {
        appendMessage('ai', action.message)
        setSuggestedOptions(action.suggestions ?? [])
        break
      }

      case 'show_products': {
        const a = action as ShowProductsAction
        const resultSet: SearchResultSet = {
          fdaResults: a.fda_results ?? [],
          aiResults: a.ai_results ?? [],
          fdaResultsText: a.fda_results_text ?? '',
          aiResultsText: a.ai_results_text ?? '',
        }
        appendMessage('ai', a.message, resultSet)
        setSuggestedOptions([])
        break
      }

      case 'start_analysis': {
        const a = action as StartAnalysisAction
        if (a.message) appendMessage('ai', a.message)
        setSuggestedOptions([])

        const collectedForAnalysis: CollectedParams = {
          deviceName: a.product_name,
          productCodes: a.product_codes,
          intendedUse: '',
          selectedProducts: selectedProductsRef.current,
        }

        trackEvent('generate_report', {
          product_name: a.product_name,
          selected_products_count: selectedProductsRef.current.length,
          product_codes: a.product_codes.join(','),
        })

        setCollected(prev => ({
          ...prev,
          deviceName: a.product_name,
          productCodes: a.product_codes,
          intendedUse: '',
        }))

        await startAnalysisGenerationWith(collectedForAnalysis)
        break
      }

      case 'error': {
        appendMessage('ai', action.message)
        setSuggestedOptions([])
        break
      }
    }
  }, [appendMessage, startAnalysisGenerationWith])

  // ─── Core agent call ─────────────────────────────────────────────────────────
  const callAgent = useCallback(async (history: AgentHistoryMessage[]) => {
    setIsLoading(true)
    try {
      await waitForAuth()
      const headers = await getAuthHeaders()
      const response = await fetch(`${API_URL}/api/v1/anonclient/agent`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      })

      if (!response.ok) {
        let detail = ''
        try { const body = await response.json(); detail = body?.detail || JSON.stringify(body) } catch {}
        throw new Error(`${response.status}: ${detail || 'Unknown server error'}`)
      }

      const data: AgentResponse = await response.json()
      console.log('[Agent] Response:', data)

      // Append assistant action into history
      const newHistory: AgentHistoryMessage[] = [
        ...history,
        { role: 'assistant', action: data.action },
      ]
      pushHistory(newHistory)

      await handleAction(data.action)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[Agent] Error:', msg)
      const display = msg.startsWith('401')
        ? 'Authentication failed. Please refresh the page and try again.'
        : msg.startsWith('429')
        ? 'Too many requests. Please wait a moment and try again.'
        : msg.startsWith('5') || msg.startsWith('50')
        ? `Server error — ${msg}. Please try again.`
        : 'Sorry, something went wrong. Please try again.'
      appendMessage('ai', display)
      setSuggestedOptions([])
    } finally {
      setIsLoading(false)
    }
  }, [appendMessage, handleAction, pushHistory])

  // ─── Public: user sends a text message ───────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return
    const trimmed = text.trim()
    setSuggestedOptions([])
    appendMessage('user', trimmed)

    const newHistory: AgentHistoryMessage[] = [
      ...agentHistoryRef.current,
      { role: 'user', content: trimmed },
    ]
    pushHistory(newHistory)
    await callAgent(newHistory)
  }, [isLoading, appendMessage, pushHistory, callAgent])

  // ─── Public: user confirms product selection → agent continues ──────────────
  // This replaces the old "startAnalysisGeneration" that would immediately launch
  // the analysis. Now it passes the selection to the agent, which will ask for
  // intended_use and then return start_analysis.
  const startAnalysisGeneration = useCallback(async () => {
    const selected = selectedProductsRef.current
    if (selected.length === 0) {
      alert('Please select at least one product from the search results.')
      return
    }

    const codes = selected.map(p => p.productCode).filter(Boolean) as string[]
    const deviceName = collected.deviceName ?? (selected[0]?.device || selected[0]?.deviceName || '')

    setSuggestedOptions([])

    const toolResult: AgentHistoryMessage = {
      role: 'tool_result',
      tool: 'user_selected_products',
      data: {
        product_codes: codes,
        device_name: deviceName,
        count: selected.length,
      },
    }

    const newHistory: AgentHistoryMessage[] = [...agentHistoryRef.current, toolResult]
    pushHistory(newHistory)
    await callAgent(newHistory)
  }, [collected.deviceName, pushHistory, callAgent])

  // ─── Public: toggle product checkbox ────────────────────────────────────────
  const toggleProduct = useCallback((product: SimilarProduct) => {
    setCollected(prev => {
      const alreadySelected = prev.selectedProducts.some(p => p.id === product.id)
      const newSelected = alreadySelected
        ? prev.selectedProducts.filter(p => p.id !== product.id)
        : [...prev.selectedProducts, product]
      const newCodes = newSelected
        .map(p => p.productCode)
        .filter((c): c is string => Boolean(c))

      // Keep ref in sync for handleAction
      selectedProductsRef.current = newSelected
      setIsReadyToStart(newCodes.length > 0)

      const deviceName = prev.deviceName
        ?? (newSelected[0]?.device || newSelected[0]?.deviceName || null)

      return { ...prev, deviceName, selectedProducts: newSelected, productCodes: newCodes }
    })
  }, [])

  // ─── Public: retry search (just send as new user message) ───────────────────
  const retrySearch = useCallback(async (newDeviceName: string) => {
    const trimmed = newDeviceName.trim()
    if (!trimmed) return
    await sendMessage(trimmed)
  }, [sendMessage])

  // ─── Fetch report data after completion ─────────────────────────────────────
  const fetchReportData = useCallback(async (): Promise<Hazard[]> => {
    if (!analysisId) throw new Error('No analysis ID available')
    const response = await analysisApi.getAnalysisResults(analysisId, 1, 100)
    if (!response.results || response.results.length === 0) throw new Error('No hazards found in the analysis')
    return response.results
  }, [analysisId])

  // ─── Reset everything ────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setMessages([{
      id: '1',
      type: 'ai',
      content: "Hello! I'm here to help you generate a PHA Analysis. What is the name of your device? If you already know your FDA product code, you can enter it directly — e.g. **KZH**.",
      timestamp: Date.now(),
    }])
    setSuggestedOptions([])
    setCollected({ deviceName: null, productCodes: [], intendedUse: null, selectedProducts: [] })
    setLatestSearchMsgId(null)
    setIsReadyToStart(false)
    setAnalysisId(null)
    setCountdown(null)
    setPhase('chat')
    pushHistory([])
    selectedProductsRef.current = []
  }, [pushHistory])

  return {
    messages,
    suggestedOptions,
    collected,
    latestSearchMsgId,
    isReadyToStart,
    isLoading,
    analysisId,
    countdown,
    phase,
    workflowEndRef,
    sendMessage,
    toggleProduct,
    retrySearch,
    startAnalysisGeneration,
    fetchReportData,
    reset,
    productName: collected.deviceName || '',
    intendedUse: collected.intendedUse || '',
  }
}
