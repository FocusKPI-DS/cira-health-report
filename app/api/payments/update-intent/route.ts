import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

// Initialize Stripe with secret key from environment variable
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')

interface UpdateIntentRequest {
  paymentIntentId: string
  analysisId: string
}

/**
 * Update a PaymentIntent's metadata with the actual analysis_id after analysis is generated
 * 
 * POST /api/payments/update-intent
 * Body: { paymentIntentId, analysisId }
 * 
 * Returns: { success: true, paymentIntentId }
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

    const body: UpdateIntentRequest = await request.json()
    const { paymentIntentId, analysisId } = body

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: 'Payment Intent ID is required' },
        { status: 400 }
      )
    }

    if (!analysisId) {
      return NextResponse.json(
        { error: 'Analysis ID is required' },
        { status: 400 }
      )
    }

    // Retrieve the PaymentIntent to get current metadata
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    // Update the PaymentIntent metadata with the actual analysis_id
    const updatedPaymentIntent = await stripe.paymentIntents.update(paymentIntentId, {
      metadata: {
        ...paymentIntent.metadata,
        analysis_id: analysisId, // Update with actual analysis_id
      },
    })

    console.log('[Update Payment Intent] Updated payment intent:', paymentIntentId, 'with analysis_id:', analysisId)

    return NextResponse.json({
      success: true,
      paymentIntentId: updatedPaymentIntent.id,
      analysisId: updatedPaymentIntent.metadata.analysis_id,
    })

  } catch (error: any) {
    console.error('[Update Payment Intent] Error:', error)
    
    // Handle Stripe-specific errors
    if (error.type === 'StripeInvalidRequestError') {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Failed to update payment intent',
        details: error.message 
      },
      { status: 500 }
    )
  }
}

