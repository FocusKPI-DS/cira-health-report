import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { Transaction } from '@/lib/types/stripe'

// Initialize Stripe with secret key from environment variable
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')

/**
 * Fetch all transactions for a user from Stripe
 * 
 * GET /api/payments/transactions?userId=xxx
 * 
 * Returns: { transactions: Transaction[], total: number }
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
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Find customer by Firebase UID in metadata
    const allCustomers = await stripe.customers.list({ limit: 100 })
    const customer = allCustomers.data.find(
      (c) => c.metadata?.firebase_uid === userId
    )

    if (!customer) {
      // No customer found means no transactions
      return NextResponse.json({
        transactions: [],
        total: 0,
      })
    }

    // Fetch all PaymentIntents for this customer
    const paymentIntents = await stripe.paymentIntents.list({
      customer: customer.id,
      limit: 100, // Adjust if needed
    })

    // Fetch charges to get receipt URLs
    const charges = await stripe.charges.list({
      customer: customer.id,
      limit: 100,
    })

    // Create a map of payment intent ID to charge (for receipt URLs)
    const chargeMap = new Map<string, Stripe.Charge>()
    charges.data.forEach((charge) => {
      if (charge.payment_intent && typeof charge.payment_intent === 'string') {
        chargeMap.set(charge.payment_intent, charge)
      }
    })

    // Transform PaymentIntents to Transaction objects
    const transactions: Transaction[] = paymentIntents.data.map((pi) => {
      const charge = chargeMap.get(pi.id)
      const receiptUrl = charge?.receipt_url || null

      // Map Stripe status to our Transaction status
      let status: Transaction['status'] = 'pending'
      if (pi.status === 'succeeded') {
        status = 'succeeded'
      } else if (pi.status === 'canceled') {
        status = 'canceled'
      } else if (pi.status === 'processing' || pi.status === 'requires_action') {
        status = 'pending'
      } else {
        status = 'failed'
      }

      // Check if charge was refunded
      if (charge?.refunded) {
        status = 'refunded'
      }

      return {
        id: pi.id,
        paymentIntentId: pi.id,
        amount: pi.amount / 100, // Convert from cents
        currency: pi.currency,
        status: status,
        createdAt: new Date(pi.created * 1000).toISOString(),
        receiptUrl: receiptUrl,
        reportId: pi.metadata?.report_id || undefined,
        productName: pi.metadata?.product_name || undefined,
        description: pi.description || undefined,
      }
    })

    // Sort by creation date (newest first)
    transactions.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return NextResponse.json({
      transactions: transactions,
      total: transactions.length,
    })

  } catch (error: any) {
    console.error('[Fetch Transactions] Error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch transactions',
        details: error.message 
      },
      { status: 500 }
    )
  }
}

