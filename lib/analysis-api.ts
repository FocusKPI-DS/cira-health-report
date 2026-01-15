import { getAuthHeaders } from './api-utils'

// API base URL - uses environment variable for production, falls back to localhost for development
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'

export interface StartAnalysisResponse {
  success: boolean
  analysis_id: string
  task_id: string
  product_id: string
  config_id: string
  message: string
}

export interface AnalysisStatusResponse {
  status: 'Generating' | 'Completed' | 'Failed'
  detail: string
  analysis_id?: string
  result?: any
}

export interface AnalysisResultResponse {
  results: any[]
  total_count: number
  page: number
  page_size: number
}

export interface HazardData {
  hazard: string
  potentialHarm: string
  severity: string[]
}

/**
 * Transform API results from nested structure to flat array for table display
 */
function transformAnalysisResults(apiResults: any): HazardData[] {
  console.log('[Transform] Input data:', JSON.stringify(apiResults, null, 2))
  
  if (!apiResults || !apiResults.results || !Array.isArray(apiResults.results)) {
    console.log('[Transform] Invalid input or no results array')
    return []
  }

  const hazards: HazardData[] = []

  // Iterate through each hazard group
  apiResults.results.forEach((hazardGroup: any, index: number) => {
    console.log(`[Transform] Processing hazard group ${index}:`, hazardGroup.hazard)
    const hazardName = hazardGroup.hazard

    // Iterate through each potential harm in this hazard
    hazardGroup.hazard_list?.forEach((harmGroup: any, harmIndex: number) => {
      console.log(`[Transform]   Processing harm ${harmIndex}:`, harmGroup.potential_harm)
      const potentialHarm = harmGroup.potential_harm

      // Collect all severities for this hazard-harm pair
      const severities: string[] = []
      harmGroup.potential_harm_list?.forEach((severityItem: any) => {
        console.log(`[Transform]     Severity item:`, severityItem.severity, 'count:', severityItem.count)
        // Add severity only if count > 0
        if (severityItem.count > 0) {
          severities.push(severityItem.severity)
        }
      })

      // Only add if there are severities
      if (severities.length > 0) {
        const hazardData = {
          hazard: hazardName,
          potentialHarm: potentialHarm,
          severity: severities
        }
        console.log(`[Transform]     Adding hazard:`, hazardData)
        hazards.push(hazardData)
      } else {
        console.log(`[Transform]     No severities found for this harm`)
      }
    })
  })

  console.log('[Transform] Total hazards found:', hazards.length)
  console.log('[Transform] Output data:', hazards)
  return hazards
}


export const analysisApi = {
  /**
   * Start a new PHA analysis
   * @param productCodes Array of FDA product codes to analyze
   * @param similarProducts Array of complete similar product objects from FDA
   * @param intendedUse Optional intended use description
   */
  async startAnalysis(productCodes: string[], similarProducts: any[] = [], intendedUse?: string): Promise<StartAnalysisResponse> {
    const headers = await getAuthHeaders()
    
    const response = await fetch(`${API_URL}/api/v1/anonclient/start-analysis`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_codes: productCodes,
        similar_products: similarProducts,
        intended_use_snapshot: intendedUse || null
      }),
    })
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to start analysis' }))
      throw new Error(error.detail || 'Failed to start analysis')
    }
    
    return response.json()
  },

  /**
   * Check the status of an analysis
   * @param analysisId The analysis ID to check
   */
  async checkAnalysisStatus(analysisId: string): Promise<AnalysisStatusResponse> {
    const headers = await getAuthHeaders()
    const response = await fetch(
      `${API_URL}/api/v1/anonclient/analysis-status?analysis_id=${encodeURIComponent(analysisId)}`,
      {
        method: 'GET',
        headers,
      }
    )
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to check analysis status' }))
      throw new Error(error.detail || 'Failed to check analysis status')
    }
    
    return response.json()
  },

  /**
   * Get analysis results
   * @param analysisId The analysis ID
   * @param page Page number (default: 1)
   * @param pageSize Page size (default: 20)
   */
  async getAnalysisResults(analysisId: string, page: number = 1, pageSize: number = 20): Promise<AnalysisResultResponse> {
    const headers = await getAuthHeaders()
    const response = await fetch(
      `${API_URL}/api/v1/analyses/${encodeURIComponent(analysisId)}/pha/grouped-details?page=${page}&page_size=${pageSize}`,
      {
        method: 'GET',
        headers,
      }
    )
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to get analysis results' }))
      throw new Error(error.detail || 'Failed to get analysis results')
    }
    
    return response.json()
  },

  /**
   * Start analysis and poll for completion
   * @param productCodes Array of FDA product codes to analyze
   * @param similarProducts Array of complete similar product objects from FDA
   * @param intendedUse Optional intended use description
   * @param onStatusUpdate Callback for status updates
   * @param pollInterval Polling interval in milliseconds (default: 5000)
   * @returns Final analysis status with analysisId (results not fetched automatically)
   */
  async startAnalysisAndPoll(
    productCodes: string[],
    similarProducts: any[] = [],
    intendedUse?: string,
    onStatusUpdate?: (status: AnalysisStatusResponse) => void,
    pollInterval: number = 5000
  ): Promise<AnalysisStatusResponse & { analysisId: string }> {
    // Start the analysis
    const startResponse = await this.startAnalysis(productCodes, similarProducts, intendedUse)
    const analysisId = startResponse.analysis_id

    // Poll for status
    return new Promise((resolve, reject) => {
      const pollStatus = async () => {
        try {
          const statusResponse = await this.checkAnalysisStatus(analysisId)
          
          // Notify callback
          if (onStatusUpdate) {
            onStatusUpdate(statusResponse)
          }

          // Stop polling when status is not 'Generating'
          if (statusResponse.status !== 'Generating') {
            // Don't fetch results automatically - let user click View Report
            resolve({ ...statusResponse, analysisId })
            return
          }

          // Continue polling
          setTimeout(pollStatus, pollInterval)
        } catch (error) {
          reject(error)
        }
      }

      // Start polling
      pollStatus()
    })
  },

  /**
   * Fetch and transform analysis results
   * @param analysisId The analysis ID
   * @param page Page number (default: 1)
   * @param pageSize Page size (default: 20)
   * @returns Transformed hazard data ready for display
   */
  async fetchTransformedResults(analysisId: string, page: number = 1, pageSize: number = 20): Promise<HazardData[]> {
    const results = await this.getAnalysisResults(analysisId, page, pageSize)
    return transformAnalysisResults(results)
  }
}
