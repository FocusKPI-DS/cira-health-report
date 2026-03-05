// Shared types for generate workflow

export interface SearchResultSet {
  fdaResults: SimilarProduct[]
  aiResults: SimilarProduct[]
  fdaResultsText: string
  aiResultsText: string
}

export interface SimilarProduct {
  id: string
  productCode: string
  device: string
  regulationDescription: string
  medicalSpecialty: string
  deviceClass?: string
  regulationNumber?: string
  fdaClassificationLink?: string
  similarity?: string
  source?: string
  // AI-specific fields
  deviceName?: string  // For AI results, deviceName is used instead of device
  manufacturer?: string
  reason?: string
}

export interface SeverityItem {
  severity: string
  severity_rowspan: number
  count: number
  last_edit_by: string
  last_edit_by_name: string | null
  last_edit_at: string
}

export interface PotentialHarmItem {
  potential_harm: string
  harm_rowspan: number
  potential_harm_list: SeverityItem[]
}

export interface Hazard {
  hazard: string
  hazard_count: number
  hazard_rowspan: number
  hazard_list: PotentialHarmItem[]
}

export type WorkflowStep = 
  | 'device-name' 
  | 'product-code-question'
  | 'intended-use-question' 
  | 'intended-use-input' 
  | 'searching-products' 
  | 'similar-products' 
  | 'no-products-found' 
  | 'product-selection' 
  | 'generating' 
  | 'completed'

export interface Message {
  id: string
  type: 'ai' | 'user'
  content: string
  step?: WorkflowStep
  timestamp: number
  /** Embedded search results to render inline with this message */
  searchResultSet?: SearchResultSet
}

// ─── Agent types ──────────────────────────────────────────────────────────────

export interface AskAction {
  type: 'ask'
  field: 'device_name' | 'product_code' | 'intended_use' | 'open'
  message: string
  placeholder?: string
  suggestions?: string[]
  skippable?: boolean
}

export interface MessageAction {
  type: 'message'
  message: string
  suggestions?: string[]
}

export interface ShowProductsAction {
  type: 'show_products'
  message: string
  allow_retry: boolean
  fda_results: SimilarProduct[]
  ai_results: SimilarProduct[]
  fda_results_text: string
  ai_results_text: string
}

export interface StartAnalysisAction {
  type: 'start_analysis'
  product_name: string
  product_codes: string[]
  intended_use?: string
  message?: string
}

export interface ErrorAction {
  type: 'error'
  message: string
  recoverable: boolean
}

export type AgentAction =
  | AskAction
  | MessageAction
  | ShowProductsAction
  | StartAnalysisAction
  | ErrorAction

export interface AgentHistoryMessage {
  role: 'user' | 'assistant' | 'tool_result'
  content?: string
  action?: AgentAction
  tool?: string
  data?: unknown
}

export interface AgentResponse {
  reasoning: string
  action: AgentAction
}
