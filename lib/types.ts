// Shared types for generate workflow

export interface SimilarProduct {
  id: string
  productCode: string
  device: string
  regulationDescription: string
  medicalSpecialty: string
  fdaClassificationLink?: string
}

export interface Hazard {
  hazard: string
  potentialHarm: string
  severity: string[]
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
