import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

// Initialize Stripe with secret key from environment variable
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')

interface CreateIntentRequest {
  amount: number
  currency?: string
  reportId?: string
  userId: string
  productName?: string
}

/**
 * Create a Stripe PaymentIntent for report download payment
 * 
 * POST /api/payments/create-intent
 * Body: { amount, currency, reportId, userId, productName }
 * 
 * Returns: { clientSecret, paymentIntentId }
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

    const body: CreateIntentRequest = await request.json()
    const { amount, currency = 'usd', reportId, userId, productName } = body

    // Validate required fields
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount is required and must be greater than 0' },
        { status: 400 }
      )
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Create or retrieve Stripe customer
    // List customers and find by Firebase UID in metadata
    let customerId: string | undefined

    // List customers and filter by metadata (Stripe doesn't support metadata filtering in list)
    const allCustomers = await stripe.customers.list({ limit: 100 })
    const existingCustomer = allCustomers.data.find(
      (customer) => customer.metadata?.firebase_uid === userId
    )

    if (existingCustomer) {
      customerId = existingCustomer.id
    } else {
      // Create new customer with Firebase UID in metadata
      const customer = await stripe.customers.create({
        metadata: {
          firebase_uid: userId,
        },
      })
      customerId = customer.id
    }

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      customer: customerId,
      metadata: {
        firebase_uid: userId,
        report_id: reportId || '',
        product_name: productName || '',
      },
      description: productName 
        ? `Full Report Download - ${productName}`
        : 'Full Report Download',
      automatic_payment_methods: {
        enabled: true,
      },
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    })

  } catch (error: any) {
    console.error('[Create Payment Intent] Error:', error)
    
    // Handle Stripe-specific errors
    if (error.type === 'StripeCardError') {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Failed to create payment intent',
        details: error.message 
      },
      { status: 500 }
    )
  }
}

