/**
 * Utility functions for payment and user status checks
 */

import { analysisApi } from './analysis-api'
import { getFirebaseAuth } from './firebase'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002'
export interface UserPaymentStatus {
  hasSuccessfulPayment: boolean
  hasCompletedAnalysis: boolean
  isFirstTimeUser: boolean
  requiresPaymentBeforeGeneration: boolean
}

/**
 * Check if user has any successful payment transactions
 * Note: This function is deprecated - use backend API instead
 */
export async function hasSuccessfulPayment(userId: string): Promise<boolean> {
  try {
    // This function is no longer used with backend integration
    // Keeping for backwards compatibility
    console.warn('[Payment Utils] hasSuccessfulPayment is deprecated')
    return false
  } catch (error) {
    console.error('[Payment Utils] Error checking payment status:', error)
    return false
  }
}

/**
 * Check if user has any completed analyses
 */
export async function hasCompletedAnalysis(userId: string): Promise<boolean> {
  try {
    const analyses = await analysisApi.fetchReportList()
    // Check if user has any completed analyses
    return analyses && analyses.length > 0
  } catch (error) {
    console.error('[Payment Utils] Error checking analysis history:', error)
    return false
  }
}

/**
 * Get comprehensive user payment status
 * Determines if user is first-time and if payment is required before generation
 */
export async function getUserPaymentStatus(userId: string): Promise<UserPaymentStatus> {
  console.log('[Payment Utils] Checking user status for userId:', userId)
  
  const [hasPayment, hasAnalysis] = await Promise.all([
    hasSuccessfulPayment(userId),
    hasCompletedAnalysis(userId)
  ])

  console.log('[Payment Utils] Payment status:', { hasPayment, hasAnalysis })

  const isFirstTimeUser = !hasPayment && !hasAnalysis
  const requiresPaymentBeforeGeneration = hasPayment || hasAnalysis

  console.log('[Payment Utils] Final status:', { isFirstTimeUser, requiresPaymentBeforeGeneration })

  return {
    hasSuccessfulPayment: hasPayment,
    hasCompletedAnalysis: hasAnalysis,
    isFirstTimeUser,
    requiresPaymentBeforeGeneration
  }
}

/**
 * Check if a specific analysis has been paid for
 * Uses backend API for payment status check
 */
export async function isAnalysisPaidFor(analysisId: string): Promise<boolean> {
  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser
    if (!user) {
      console.error('[Payment Utils] No authenticated user')
      return false
    }

    const token = await user.getIdToken()
    const response = await fetch(`${API_URL}/orders/analysis/${encodeURIComponent(analysisId)}/status`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
    
    if (!response.ok) {
      return false
    }

    const data = await response.json()
    return data.paid || false
  } catch (error) {
    console.error('[Payment Utils] Error checking analysis payment:', error)
    return false
  }
}

