// Shared types for generate workflow

export type DbSearchType = 'product_code' | 'brand_name' | 'generic_name' | 'keyword'

export interface DbResultGroup {
  value: string
  count: number
}

export interface DbResults {
  total: number
  keyword: string
  by_brand: DbResultGroup[]
  by_generic: DbResultGroup[]
  by_product_code: DbResultGroup[]
}

/** Tracks what the user has selected in the DB results panel */
export interface DbSearchSelection {
  type: DbSearchType
  values: string[]      // for product_code / brand_name / generic_name
  keyword: string       // for keyword (All)
}

export interface SearchResultSet {
  fdaResults: SimilarProduct[]
  aiResults: SimilarProduct[]
  fdaResultsText: string
  aiResultsText: string
  dbResults?: DbResults
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
  llm_processed?: boolean
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
  /** ISO 24971 module question options to render as buttons */
  moduleQuestion?: ModuleQuestionAction
  /** ISO 24971 hazard summary to render inline */
  hazardSummary?: HazardSummaryAction
  /** ISO 24971 checklist form — rendered as interactive form panel */
  isoChecklist?: boolean
  /** Pre-filled answers for ISO checklist from agent (intended use flow) */
  isoChecklistDefaults?: Record<string, string>
  /** Intended Use hazard selector panel */
  intendedUseHazard?: boolean
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
  db_results?: DbResults
}

export interface StartAnalysisAction {
  type: 'start_analysis'
  product_name: string
  product_codes: string[]
  hazard_categories?: string[]
  message?: string
}

export interface ModuleQuestionAction {
  type: 'module_question'
  module: number
  module_name: string
  question_index: number
  message: string
  options: string[]
}

export interface HazardSummaryAction {
  type: 'hazard_summary'
  message: string
  hazard_categories: string[]
}

export interface ShowIsoChecklistAction {
  type: 'show_iso_checklist'
  message: string
  /** key: "${module}-${questionIndex}", value: selected option string */
  pre_filled_answers: Record<string, string>
}

export interface ErrorAction {
  type: 'error'
  message: string
  recoverable: boolean
}

export interface ToolCallAction {
  type: 'tool_call'
  tool: string
  params: Record<string, string>
}

export type AgentAction =
  | AskAction
  | MessageAction
  | ShowProductsAction
  | StartAnalysisAction
  | ModuleQuestionAction
  | HazardSummaryAction
  | ShowIsoChecklistAction
  | ErrorAction
  | ToolCallAction

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
