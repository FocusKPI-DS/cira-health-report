import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { Transaction } from '@/lib/types/stripe'

// Initialize Stripe with secret key from environment variable
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')

interface ConfirmPaymentRequest {
  paymentIntentId: string
}

/**
 * Confirm a payment after Payment Element submission
 * 
 * POST /api/payments/confirm
 * Body: { paymentIntentId }
 * 
 * Returns: { success, paymentIntentId, transaction, receiptUrl }
 */
export async function POST(request: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.' },
        { status: 500 }
      )
    }

    const body: ConfirmPaymentRequest = await request.json()
    const { paymentIntentId } = body

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'Payment Intent ID is required' },
        { status: 400 }
      )
    }

    // Retrieve the PaymentIntent to check its status
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    // Check if payment was successful
    if (paymentIntent.status !== 'succeeded') {
      return NextResponse.json(
        { 
          error: `Payment not completed. Status: ${paymentIntent.status}`,
          status: paymentIntent.status
        },
        { status: 400 }
      )
    }

    // Get the charge to retrieve receipt URL
    const charges = await stripe.charges.list({
      payment_intent: paymentIntentId,
      limit: 1,
    })

    const charge = charges.data[0]
    const receiptUrl = charge?.receipt_url || null
    // Use Stripe's receipt_number field (format: "1246-6135")
    const receiptNumber = charge?.receipt_number || undefined

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
        console.error('[Confirm Payment] Error fetching payment method:', pmError)
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
      paymentIntentId: paymentIntent.id,
      transaction: transaction,
      receiptUrl: receiptUrl,
    })

  } catch (error: any) {
    console.error('[Confirm Payment] Error:', error)
    
    // Handle Stripe-specific errors
    if (error.type === 'StripeInvalidRequestError') {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Failed to confirm payment',
        details: error.message 
      },
      { status: 500 }
    )
  }
}

