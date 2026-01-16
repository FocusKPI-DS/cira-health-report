import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

// Initialize Stripe with secret key from environment variable
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')

interface CancelIntentRequest {
  paymentIntentId: string
}

/**
 * Cancel a PaymentIntent that hasn't been submitted
 * 
 * POST /api/payments/cancel-intent
 * Body: { paymentIntentId }
 * 
 * Returns: { success, canceled: boolean }
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

    const body: CancelIntentRequest = await request.json()
    const { paymentIntentId } = body

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'Payment Intent ID is required' },
        { status: 400 }
      )
    }

    // Retrieve the PaymentIntent to check its status
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    // Only cancel if it's in an incomplete state (not yet submitted)
    // Don't cancel if it's pending (processing, requires_action) - those are being processed
    const incompleteStatuses = ['requires_payment_method', 'requires_confirmation']
    const pendingStatuses = ['processing', 'requires_action', 'requires_capture']
    
    if (incompleteStatuses.includes(paymentIntent.status)) {
      // Cancel the PaymentIntent - it was never submitted
      const canceled = await stripe.paymentIntents.cancel(paymentIntentId)
      
      return NextResponse.json({
        success: true,
        canceled: true,
        status: canceled.status,
      })
    } else if (pendingStatuses.includes(paymentIntent.status)) {
      // PaymentIntent is pending/processing - don't cancel it
      return NextResponse.json({
        success: true,
        canceled: false,
        message: `PaymentIntent is in ${paymentIntent.status} status (pending/processing) and should not be canceled`,
        status: paymentIntent.status,
      })
    } else {
      // PaymentIntent is already completed (succeeded, failed, canceled) - can't cancel
      return NextResponse.json({
        success: true,
        canceled: false,
        message: `PaymentIntent is in ${paymentIntent.status} status and cannot be canceled`,
        status: paymentIntent.status,
      })
    }

  } catch (error: any) {
    console.error('[Cancel Payment Intent] Error:', error)
    
    // Handle Stripe-specific errors
    if (error.type === 'StripeInvalidRequestError') {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Failed to cancel payment intent',
        details: error.message 
      },
      { status: 500 }
    )
  }
}

