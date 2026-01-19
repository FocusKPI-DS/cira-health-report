/**
 * Utility functions for payment and user status checks
 */

import { analysisApi } from './analysis-api'

export interface UserPaymentStatus {
  hasSuccessfulPayment: boolean
  hasCompletedAnalysis: boolean
  isFirstTimeUser: boolean
  requiresPaymentBeforeGeneration: boolean
}

/**
 * Check if user has any successful payment transactions
 */
export async function hasSuccessfulPayment(userId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/payments/transactions?userId=${encodeURIComponent(userId)}`)
    
    if (!response.ok) {
      console.error('[Payment Utils] Failed to fetch transactions:', response.status)
      return false
    }

    const data = await response.json()
    const successfulPayments = data.transactions?.filter(
      (t: any) => t.status === 'succeeded'
    ) || []
    
    return successfulPayments.length > 0
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
 */
export async function isAnalysisPaidFor(analysisId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/payments/transactions?analysisId=${encodeURIComponent(analysisId)}`)
    
    if (!response.ok) {
      return false
    }

    const data = await response.json()
    const successfulPayments = data.transactions?.filter(
      (t: any) => t.status === 'succeeded'
    ) || []
    
    return successfulPayments.length > 0
  } catch (error) {
    console.error('[Payment Utils] Error checking analysis payment:', error)
    return false
  }
}

