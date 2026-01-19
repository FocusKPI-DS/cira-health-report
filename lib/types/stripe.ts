/**
 * Stripe-related type definitions
 */

export interface Transaction {
  id: string
  paymentIntentId: string
  amount: number
  currency: string
  status: 'succeeded' | 'failed' | 'refunded' | 'pending' | 'canceled'
  createdAt: string // ISO date string
  receiptUrl: string | null // Stripe hosted receipt URL
  receiptNumber?: string // Receipt number extracted from Stripe receipt URL
  reportId?: string
  analysisId?: string
  productName?: string
  description?: string
  paymentMethod?: {
    type: string // e.g., 'card'
    card?: {
      brand: string // e.g., 'visa', 'mastercard'
      last4: string // Last 4 digits
    }
  }
}

export interface PaymentIntentResponse {
  clientSecret: string
  paymentIntentId: string
}

export interface ConfirmPaymentResponse {
  success: boolean
  paymentIntentId: string
  transaction: Transaction
  receiptUrl: string
}

export interface TransactionsResponse {
  transactions: Transaction[]
  total: number
}

