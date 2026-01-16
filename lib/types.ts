// Shared types for generate workflow

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
}
