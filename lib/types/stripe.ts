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
  reportId?: string
  productName?: string
  description?: string
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

