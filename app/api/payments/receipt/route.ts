import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { Transaction } from '@/lib/types/stripe'

// Initialize Stripe with secret key from environment variable
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')

interface ReceiptRequest {
  paymentIntentId: string
}

/**
 * Get receipt details including payment method for a specific transaction
 * 
 * GET /api/payments/receipt?paymentIntentId=pi_xxx
 * 
 * Returns: { success, transaction }
 */
export async function GET(request: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.' },
        { status: 500 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const paymentIntentId = searchParams.get('paymentIntentId')

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'Payment Intent ID is required' },
        { status: 400 }
      )
    }

    // Retrieve the PaymentIntent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    // Get the charge to retrieve receipt URL
    const charges = await stripe.charges.list({
      payment_intent: paymentIntentId,
      limit: 1,
    })

    const charge = charges.data[0]
    const receiptUrl = charge?.receipt_url || null

    // Extract receipt number from receipt URL
    let receiptNumber: string | undefined
    if (receiptUrl) {
      const receiptMatch = receiptUrl.match(/receipts\/([^\/]+)/)
      if (receiptMatch && receiptMatch[1]) {
        receiptNumber = receiptMatch[1]
      }
    }

    // Fetch payment method details if available
    let paymentMethod: Transaction['paymentMethod'] | undefined
    if (paymentIntent.payment_method) {
      try {
        const pm = await stripe.paymentMethods.retrieve(
          typeof paymentIntent.payment_method === 'string' 
            ? paymentIntent.payment_method 
            : paymentIntent.payment_method.id
        )
        
        if (pm.type === 'card' && pm.card) {
          paymentMethod = {
            type: 'card',
            card: {
              brand: pm.card.brand,
              last4: pm.card.last4,
            }
          }
        }
      } catch (pmError) {
        console.error('[Receipt] Error fetching payment method:', pmError)
        // Continue without payment method details
      }
    }

    // Build transaction object
    const transaction: Transaction = {
      id: paymentIntent.id,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount / 100, // Convert from cents
      currency: paymentIntent.currency,
      status: paymentIntent.status as Transaction['status'],
      createdAt: new Date(paymentIntent.created * 1000).toISOString(),
      receiptUrl: receiptUrl,
      receiptNumber: receiptNumber,
      reportId: paymentIntent.metadata?.report_id || undefined,
      analysisId: paymentIntent.metadata?.analysis_id || undefined,
      productName: paymentIntent.metadata?.product_name || undefined,
      description: paymentIntent.description || undefined,
      paymentMethod: paymentMethod,
    }

    return NextResponse.json({
      success: true,
      transaction: transaction,
    })

  } catch (error: any) {
    console.error('[Receipt] Error:', error)
    
    // Handle Stripe-specific errors
    if (error.type === 'StripeInvalidRequestError') {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Failed to fetch receipt details',
        details: error.message 
      },
      { status: 500 }
    )
  }
}

