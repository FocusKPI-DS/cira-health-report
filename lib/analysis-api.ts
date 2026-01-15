import { getAuthHeaders } from './api-utils'

// API base URL - uses environment variable for production, falls back to localhost for development
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'

export interface StartAnalysisResponse {
  analysis_id: string
  message: string
}

export interface AnalysisStatusResponse {
  status: 'Generating' | 'Completed' | 'Failed'
  detail: string
  result?: any
}

export const analysisApi = {
  /**
   * Start a new PHA analysis
   */
  async startAnalysis(): Promise<StartAnalysisResponse> {
    const headers = await getAuthHeaders()
    const response = await fetch(`${API_URL}/api/v1/anonclient/start-analysis`, {
      method: 'POST',
      headers,
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
        method: 'POST',
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
   * Start analysis and poll for completion
   * @param onStatusUpdate Callback for status updates
   * @param pollInterval Polling interval in milliseconds (default: 5000)
   * @returns Final analysis result
   */
  async startAnalysisAndPoll(
    onStatusUpdate?: (status: AnalysisStatusResponse) => void,
    pollInterval: number = 5000
  ): Promise<AnalysisStatusResponse> {
    // Start the analysis
    const startResponse = await this.startAnalysis()
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

          // Check if completed
          if (statusResponse.status !== 'Generating') {
            resolve(statusResponse)
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
  }
}
