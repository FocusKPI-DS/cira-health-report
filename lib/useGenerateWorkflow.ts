import { useState, useEffect, useRef, useCallback } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import {
  Message, SimilarProduct, Hazard, SearchResultSet,
  AgentAction, AgentHistoryMessage, AgentResponse,
  ShowProductsAction, StartAnalysisAction, ModuleQuestionAction, HazardSummaryAction,
  ShowIsoChecklistAction, ToolCallAction, DbSearchSelection,
} from './types'
import { computeHazardCategories } from './iso-checklist'
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
  dbSearchType?: string
  dbSearchValues?: string[]
  dbSearchKeyword?: string
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
  const todayStr = new Date().toISOString().slice(0, 10)
  const [searchStartDate, setSearchStartDate] = useState('2010-01-01')
  const [searchEndDate, setSearchEndDate] = useState(todayStr)
  const searchStartDateRef = useRef('2010-01-01')
  const searchEndDateRef = useRef(todayStr)
  const setSearchStartDateAndRef = (d: string) => { searchStartDateRef.current = d; setSearchStartDate(d) }
  const setSearchEndDateAndRef = (d: string) => { searchEndDateRef.current = d; setSearchEndDate(d) }

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
  // ── DB search selection (from db_results panel) ──
  const [dbSearchSelection, setDbSearchSelection] = useState<DbSearchSelection | null>(null)
  const dbSearchSelectionRef = useRef<DbSearchSelection | null>(null)
  // ── Whether all required params are ready ──
  const [isReadyToStart, setIsReadyToStart] = useState(false)
  // ── Loading flag while waiting for AI reply or search ──
  const [isLoading, setIsLoading] = useState(false)
  // ── ISO 24971 hazard categories collected during module questioning ──
  const [hazardCategories, setHazardCategories] = useState<string[]>([])
  const hazardCategoriesRef = useRef<string[]>([])
  // ── Ready to generate after hazard summary confirmed ──
  const [isReadyToGenerate, setIsReadyToGenerate] = useState(false)
  const [pendingModeSelection, setPendingModeSelection] = useState(false)
  const [analysisMode, setAnalysisMode] = useState<'simple' | 'detailed' | null>(null)
  const [collectedForModeRef] = useState<{ current: CollectedParams | null }>({ current: null })
  // ── Analysis runtime state ──
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [phase, setPhase] = useState<'chat' | 'generating' | 'completed'>('chat')

  const workflowEndRef = useRef<HTMLDivElement>(null)
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const initializedRef = useRef(false)
  const autoSubmittedRef = useRef(false)

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
  const startAnalysisGenerationWith = useCallback(async (data: CollectedParams, hazards?: string[], mode?: string, availableHazards?: string[]) => {
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
          data.dbSearchType,
          data.dbSearchValues,
          data.dbSearchKeyword,
          hazards,
          mode,
          availableHazards,
          searchStartDateRef.current,
          searchEndDateRef.current,
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
        data.dbSearchType,
        data.dbSearchValues,
        data.dbSearchKeyword,
        hazards,
        mode,
        availableHazards,
        searchStartDateRef.current,
        searchEndDateRef.current,
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
  // Stores search results fetched client-side when handling tool_call
  const pendingSearchResultsRef = useRef<import('./types').DbResults | null>(null)

  const handleAction = useCallback(async (action: AgentAction) => {
    switch (action.type) {
      case 'ask':
      case 'message': {
        appendMessage('ai', action.message)
        setSuggestedOptions(action.suggestions ?? [])
        break
      }

      case 'tool_call': {
        const a = action as ToolCallAction
        const query = a.params?.query || a.params?.keyword || ''
        let dbResults = null
        try {
          const headers = await getAuthHeaders()
          const url = `${API_URL}/api/v1/anonclient/search-fda-products?search_type=keywords&deviceName=${encodeURIComponent(query)}&limit=20&start_date=2010-01-01`
          const res = await fetch(url, { headers })
          if (res.ok) dbResults = await res.json()
        } catch (e) {
          console.error('[tool_call] Search failed', e)
        }
        pendingSearchResultsRef.current = dbResults?.db_results ?? dbResults
        // Send tool_result back to agent (condensed summary for LLM context)
        const dbTotal = dbResults?.db_results?.total ?? dbResults?.total ?? 0
        const toolResult: AgentHistoryMessage = {
          role: 'tool_result',
          tool: a.tool,
          data: { total: dbTotal, keyword: query },
        }
        const newHistory: AgentHistoryMessage[] = [
          ...agentHistoryRef.current,
          { role: 'assistant', action },
          toolResult,
        ]
        pushHistory(newHistory)
        if (callAgentRef.current) await callAgentRef.current(newHistory)
        break
      }

      case 'show_products': {
        const a = action as ShowProductsAction
        const resultSet: SearchResultSet = {
          fdaResults: a.fda_results ?? [],
          aiResults: a.ai_results ?? [],
          fdaResultsText: a.fda_results_text ?? '',
          aiResultsText: a.ai_results_text ?? '',
          // prefer client-side fetched results; fall back to whatever agent returned
          dbResults: pendingSearchResultsRef.current ?? a.db_results,
        }
        pendingSearchResultsRef.current = null
        // Reset db selection on new search
        setDbSearchSelection(null)
        dbSearchSelectionRef.current = null
        appendMessage('ai', a.message, resultSet)
        setSuggestedOptions([])
        break
      }

      case 'start_analysis': {
        const a = action as StartAnalysisAction
        if (a.message) appendMessage('ai', a.message)
        setSuggestedOptions([])

        const dbSel = dbSearchSelectionRef.current
        const collectedForAnalysis: CollectedParams = {
          deviceName: a.product_name,
          productCodes: a.product_codes.length > 0 ? a.product_codes : (dbSel ? ['_db_'] : []),
          intendedUse: '',
          selectedProducts: selectedProductsRef.current,
          ...(dbSel ? {
            dbSearchType: dbSel.type,
            dbSearchValues: dbSel.type !== 'keyword' ? dbSel.values : undefined,
            dbSearchKeyword: dbSel.type === 'keyword' ? dbSel.keyword : undefined,
          } : {}),
        }

        trackEvent('generate_report', {
          product_name: a.product_name,
          selected_products_count: selectedProductsRef.current.length,
          product_codes: a.product_codes.join(','),
        })

        setCollected(prev => ({
          ...prev,
          deviceName: a.product_name,
          productCodes: collectedForAnalysis.productCodes,
          intendedUse: '',
        }))

        const hazardsForAnalysis = a.hazard_categories && a.hazard_categories.length > 0
          ? a.hazard_categories
          : hazardCategoriesRef.current

        await startAnalysisGenerationWith(collectedForAnalysis, hazardsForAnalysis, 'detailed', hazardsForAnalysis)
        break
      }

      case 'module_question': {
        const a = action as ModuleQuestionAction
        // Append AI message with embedded module question for button rendering
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        setMessages(prev => [...prev, {
          id,
          type: 'ai',
          content: a.message,
          timestamp: Date.now(),
          moduleQuestion: a,
        }])
        setSuggestedOptions([])
        break
      }

      case 'hazard_summary': {
        const a = action as HazardSummaryAction
        // Store categories
        hazardCategoriesRef.current = a.hazard_categories
        setHazardCategories(a.hazard_categories)
        // Append AI message with embedded hazard summary
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        setMessages(prev => [...prev, {
          id,
          type: 'ai',
          content: a.message,
          timestamp: Date.now(),
          hazardSummary: a,
        }])
        setSuggestedOptions([])
        // Wait for user to click "Generate Report"
        setIsReadyToGenerate(true)
        break
      }

      case 'show_iso_checklist': {
        const a = action as ShowIsoChecklistAction
        // Store intended use so it's included as intended_use_snapshot on submit
        if (a.intended_use && collectedForModeRef.current) {
          collectedForModeRef.current.intendedUse = a.intended_use
        }
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        setMessages(prev => [...prev, {
          id,
          type: 'ai',
          content: a.message,
          timestamp: Date.now(),
          isoChecklist: true,
          isoChecklistDefaults: a.pre_filled_answers,
        }])
        setSuggestedOptions([])
        break
      }

      case 'error': {
        appendMessage('ai', action.message)
        setSuggestedOptions([])
        break
      }

      default: {
        console.error('[Agent] Unknown action type:', (action as AgentAction & { type: string }).type, action)
        appendMessage('ai', 'Sorry, something went wrong. Please try again.')
        setSuggestedOptions([])
        break
      }
    }
  }, [appendMessage, startAnalysisGenerationWith, pushHistory])

  // Ref to break circular dependency between handleAction and callAgent
  const callAgentRef = useRef<((history: AgentHistoryMessage[]) => Promise<void>) | null>(null)

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

  // Keep ref in sync
  useEffect(() => { callAgentRef.current = callAgent }, [callAgent])

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

  // ─── Auto-submit when productName is pre-filled via URL param ───────────────
  useEffect(() => {
    if (!initialProductName || autoSubmittedRef.current) return
    autoSubmittedRef.current = true
    sendMessage(initialProductName)
  }, [sendMessage]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Public: user confirms product selection → agent continues ──────────────
  // This replaces the old "startAnalysisGeneration" that would immediately launch
  // the analysis. Now it passes the selection to the agent, which will ask for
  // intended_use and then return start_analysis.
  const startAnalysisGeneration = useCallback(async () => {
    const selected = selectedProductsRef.current
    const dbSel = dbSearchSelectionRef.current

    if (selected.length === 0 && !dbSel) {
      alert('Please select at least one product or a MAUDE database group.')
      return
    }

    // Show mode selection question
    appendMessage('ai', 'Would you like a **Simple Analysis** (start immediately) or **More Questions** (answer ISO 24971 questions for more targeted hazard analysis)?')
    setSuggestedOptions([])
    setPendingModeSelection(true)
  }, [appendMessage])

  const selectAnalysisMode = useCallback(async (mode: 'simple' | 'detailed' | 'intended-use') => {
    if (isLoading) return
    setAnalysisMode(mode === 'intended-use' ? 'detailed' : mode)
    setPendingModeSelection(false)
    appendMessage('user', mode === 'simple' ? 'Simple Analysis' : mode === 'detailed' ? 'More Questions' : 'Input Intended Use')

    const selected = selectedProductsRef.current
    const dbSel = dbSearchSelectionRef.current
    const codes = selected.map(p => p.productCode).filter(Boolean) as string[]
    const deviceName = collected.deviceName ?? (selected[0]?.device || selected[0]?.deviceName || '')

    setSuggestedOptions([])

    const collectedForMode: CollectedParams = {
      deviceName,
      productCodes: codes.length > 0 ? codes : (dbSel ? ['_db_'] : []),
      intendedUse: '',
      selectedProducts: selected,
      ...(dbSel ? {
        dbSearchType: dbSel.type,
        dbSearchValues: dbSel.type !== 'keyword' ? dbSel.values : undefined,
        dbSearchKeyword: dbSel.type === 'keyword' ? dbSel.keyword : undefined,
      } : {}),
    }
    setCollected(prev => ({
      ...prev,
      deviceName: deviceName || prev.deviceName,
      productCodes: collectedForMode.productCodes,
      intendedUse: '',
      dbSearchType: collectedForMode.dbSearchType,
      dbSearchValues: collectedForMode.dbSearchValues,
      dbSearchKeyword: collectedForMode.dbSearchKeyword,
    }))

    if (mode === 'simple') {
      await startAnalysisGenerationWith(collectedForMode, undefined, 'simple', undefined)
    } else if (mode === 'intended-use') {
      // Save params for later; route through agent to collect intended use
      collectedForModeRef.current = collectedForMode
      const newHistory: AgentHistoryMessage[] = [
        ...agentHistoryRef.current,
        { role: 'user', content: 'Input Intended Use' },
      ]
      pushHistory(newHistory)
      await callAgent(newHistory)
    } else {
      // Detailed mode: show ISO 24971 checklist form directly (no agent roundtrip)
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      setMessages(prev => [...prev, {
        id,
        type: 'ai',
        content: 'Please answer the following ISO 24971 questions to identify applicable hazard categories for your device. Select the best answer for each question, then click **Generate Report**.',
        timestamp: Date.now(),
        isoChecklist: true,
      }])
    }
  }, [isLoading, collected.deviceName, appendMessage, startAnalysisGenerationWith, pushHistory, callAgent, collectedForModeRef])

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

  // ─── Public: toggle DB result item (mutual exclusion across groups) ─────────
  const toggleDbItem = useCallback((
    type: DbSearchSelection['type'],
    value: string,      // ignored when type === 'keyword'
    keyword: string,    // the full-text keyword (from dbResults.keyword)
  ) => {
    setDbSearchSelection((prev: DbSearchSelection | null) => {
      let next: DbSearchSelection | null

      if (type === 'keyword') {
        // All — toggle off if already selected, else select
        next = prev?.type === 'keyword' ? null : { type: 'keyword', values: [], keyword }
      } else if (prev?.type === type) {
        // Same group: multi-select within group
        const already = prev.values.includes(value)
        const newValues = already ? prev.values.filter((v: string) => v !== value) : [...prev.values, value]
        next = newValues.length > 0 ? { type, values: newValues, keyword: '' } : null
      } else {
        // Different group: clear previous, start fresh
        next = { type, values: [value], keyword: '' }
      }

      dbSearchSelectionRef.current = next
      // isReadyToStart: true when db OR fda/ai items are selected
      setIsReadyToStart(
        next !== null || selectedProductsRef.current.length > 0
      )
      return next
    })
  }, [])

  // ─── Public: retry search (just send as new user message) ───────────────────
  const retrySearch = useCallback(async (newDeviceName: string) => {
    const trimmed = newDeviceName.trim()
    if (!trimmed) return
    await sendMessage(trimmed)
  }, [sendMessage])

  // ─── Public: user clicks "Generate Report" after hazard summary ─────────────
  const confirmAndGenerate = useCallback(async () => {
    if (isLoading) return
    setIsReadyToGenerate(false)
    const collectedSnap = {
      deviceName: collected.deviceName,
      productCodes: collected.productCodes,
      intendedUse: collected.intendedUse || '',
      selectedProducts: selectedProductsRef.current,
      dbSearchType: collected.dbSearchType,
      dbSearchValues: collected.dbSearchValues,
      dbSearchKeyword: collected.dbSearchKeyword,
    }
    // Use productCodes from collected; if DB path, fall back to _db_ placeholder
    const dbSel = dbSearchSelectionRef.current
    const params: CollectedParams = {
      ...collectedSnap,
      productCodes: collectedSnap.productCodes.length > 0 ? collectedSnap.productCodes : (dbSel ? ['_db_'] : []),
      ...(dbSel ? {
        dbSearchType: dbSel.type,
        dbSearchValues: dbSel.type !== 'keyword' ? dbSel.values : undefined,
        dbSearchKeyword: dbSel.type === 'keyword' ? dbSel.keyword : undefined,
      } : {}),
    }
    await startAnalysisGenerationWith(params, hazardCategoriesRef.current, 'detailed', hazardCategoriesRef.current)
  }, [isLoading, collected, startAnalysisGenerationWith])

  // ─── Public: answer a module question (Phase 2) ──────────────────────────────
  const answerModuleQuestion = useCallback(async (module: number, questionIndex: number, answer: string) => {
    if (isLoading) return
    appendMessage('user', answer)
    const toolResult: AgentHistoryMessage = {
      role: 'tool_result',
      tool: 'module_answer',
      data: { module, question_index: questionIndex, answer },
    }
    const newHistory: AgentHistoryMessage[] = [...agentHistoryRef.current, toolResult]
    pushHistory(newHistory)
    await callAgent(newHistory)
  }, [isLoading, appendMessage, pushHistory, callAgent])

  // ─── Fetch report data after completion ─────────────────────────────────────
  const fetchReportData = useCallback(async (): Promise<Hazard[]> => {
    if (!analysisId) throw new Error('No analysis ID available')
    const response = await analysisApi.getAnalysisResults(analysisId, 1, 100)
    if (!response.results || response.results.length === 0) throw new Error('No hazards found in the analysis')
    return response.results
  }, [analysisId])

  // ─── Public: submit ISO 24971 checklist answers ──────────────────────────────
  const submitIsoChecklist = useCallback(async (answers: Record<string, string>) => {
    if (isLoading) return
    const hazards = computeHazardCategories(answers)
    const dbSel = dbSearchSelectionRef.current
    const params: CollectedParams = {
      deviceName: collected.deviceName,
      productCodes: collected.productCodes.length > 0 ? collected.productCodes : (dbSel ? ['_db_'] : []),
      intendedUse: collected.intendedUse || '',
      selectedProducts: selectedProductsRef.current,
      ...(dbSel ? {
        dbSearchType: dbSel.type,
        dbSearchValues: dbSel.type !== 'keyword' ? dbSel.values : undefined,
        dbSearchKeyword: dbSel.type === 'keyword' ? dbSel.keyword : undefined,
      } : {}),
    }
    await startAnalysisGenerationWith(params, hazards, 'detailed', hazards)
  }, [isLoading, collected, startAnalysisGenerationWith])

  // ─── Public: submit intended use + selected hazards ──────────────────────────
  const submitIntendedUseHazards = useCallback(async (intendedUse: string, selectedHazards: string[]) => {
    if (isLoading) return
    const params: CollectedParams = collectedForModeRef.current ?? {
      deviceName: collected.deviceName,
      productCodes: collected.productCodes,
      intendedUse,
      selectedProducts: selectedProductsRef.current,
    }
    params.intendedUse = intendedUse
    await startAnalysisGenerationWith(params, selectedHazards, 'intended', selectedHazards)
  }, [isLoading, collected, collectedForModeRef, startAnalysisGenerationWith])

  // ─── Public: submit ISO checklist answers from intended-use flow ─────────────
  const submitIntendedIsoChecklist = useCallback(async (answers: Record<string, string>) => {
    if (isLoading) return
    const hazards = computeHazardCategories(answers)
    const params: CollectedParams = collectedForModeRef.current ?? {
      deviceName: collected.deviceName,
      productCodes: collected.productCodes,
      intendedUse: '',
      selectedProducts: selectedProductsRef.current,
    }
    await startAnalysisGenerationWith(params, hazards, 'intended', hazards)
  }, [isLoading, collected, collectedForModeRef, startAnalysisGenerationWith])

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
    setHazardCategories([])
    hazardCategoriesRef.current = []
    setIsReadyToGenerate(false)
    setPendingModeSelection(false)
    setAnalysisMode(null)
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
    toggleDbItem,
    dbSearchSelection,
    retrySearch,
    startAnalysisGeneration,
    selectAnalysisMode,
    answerModuleQuestion,
    confirmAndGenerate,
    submitIsoChecklist,
    submitIntendedIsoChecklist,
    submitIntendedUseHazards,
    hazardCategories,
    isReadyToGenerate,
    pendingModeSelection,
    analysisMode,
    fetchReportData,
    reset,
    productName: collected.deviceName || '',
    intendedUse: collected.intendedUse || '',
    searchStartDate,
    searchEndDate,
    setSearchStartDate: setSearchStartDateAndRef,
    setSearchEndDate: setSearchEndDateAndRef,
  }
}
