import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { Transaction } from '@/lib/types/stripe'

// Initialize Stripe with secret key from environment variable
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')

/**
 * Fetch all transactions for a user from Stripe
 * 
 * GET /api/payments/transactions?userId=xxx
 * GET /api/payments/transactions?analysisId=xxx (search by analysis_id in metadata)
 * 
 * Returns: { transactions: Transaction[], total: number }
 */
export async function GET(request: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('[Fetch Transactions] STRIPE_SECRET_KEY not configured')
      return NextResponse.json(
        { error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.' },
        { status: 500 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    const analysisId = searchParams.get('analysisId')

    console.log('[Fetch Transactions] Request received - userId:', userId, 'analysisId:', analysisId)

    if (!userId && !analysisId) {
      return NextResponse.json(
        { error: 'User ID or Analysis ID is required' },
        { status: 400 }
      )
    }

    // Find customer by Firebase UID in metadata
    console.log('[Fetch Transactions] Fetching customers from Stripe...')
    let allCustomers
    try {
      allCustomers = await stripe.customers.list({ limit: 100 })
      console.log('[Fetch Transactions] Found', allCustomers.data.length, 'customers')
    } catch (error: any) {
      console.error('[Fetch Transactions] Error listing customers:', error.message)
      throw new Error(`Failed to list customers: ${error.message}`)
    }
    
    let customer
    if (userId) {
      customer = allCustomers.data.find(
        (c) => c.metadata?.firebase_uid === userId
      )
      console.log('[Fetch Transactions] Customer found by userId:', !!customer)
    }

    // If searching by analysisId, fetch all payment intents and filter
    if (analysisId && !customer) {
      console.log('[Fetch Transactions] ===== SEARCHING BY ANALYSIS ID =====')
      console.log('[Fetch Transactions] Looking for analysisId:', analysisId)
      
      // Fetch all PaymentIntents (limited to reasonable amount)
      let allPaymentIntents
      try {
        allPaymentIntents = await stripe.paymentIntents.list({ limit: 100 })
        console.log('[Fetch Transactions] Total payment intents fetched:', allPaymentIntents.data.length)
      } catch (error: any) {
        console.error('[Fetch Transactions] Error listing payment intents:', error.message)
        throw new Error(`Failed to list payment intents: ${error.message}`)
      }
      
      // Filter by analysis_id in metadata
      console.log('[Fetch Transactions] Filtering payment intents by metadata.analysis_id...')
      const matchingIntents = allPaymentIntents.data.filter(
        (pi) => {
          const metadataAnalysisId = pi.metadata?.analysis_id
          const matches = metadataAnalysisId === analysisId
          if (!matches && metadataAnalysisId) {
            console.log(`[Fetch Transactions]   Payment ${pi.id}: metadata.analysis_id = "${metadataAnalysisId}" (does not match)`)
          } else if (!metadataAnalysisId) {
            console.log(`[Fetch Transactions]   Payment ${pi.id}: metadata.analysis_id = undefined/empty`)
          }
          return matches
        }
      )
      
      console.log('[Fetch Transactions] Matching payment intents found:', matchingIntents.length)
      if (matchingIntents.length > 0) {
        console.log('[Fetch Transactions] Matching payment intent IDs:', matchingIntents.map(pi => pi.id))
      }
      
      if (matchingIntents.length === 0) {
        return NextResponse.json({
          transactions: [],
          total: 0,
        })
      }
      
      // Get charges for receipt URLs
      const transactions: Transaction[] = []
      for (const pi of matchingIntents) {
        let receiptUrl = null
        try {
          const charges = await stripe.charges.list({
            payment_intent: pi.id,
            limit: 1,
          })
          receiptUrl = charges.data[0]?.receipt_url || null
        } catch (error) {
          console.error('[Fetch Transactions] Error fetching charge:', error)
        }
        
        // Map status
        let status: Transaction['status'] = 'pending'
        if (pi.status === 'succeeded') status = 'succeeded'
        else if (pi.status === 'canceled') status = 'canceled'
        else if (pi.status === 'processing' || pi.status === 'requires_action') status = 'pending'
        else status = 'failed'
        
        transactions.push({
          id: pi.id,
          paymentIntentId: pi.id,
          amount: pi.amount / 100,
          currency: pi.currency,
          status: status,
          createdAt: new Date(pi.created * 1000).toISOString(),
          receiptUrl: receiptUrl,
          reportId: pi.metadata?.report_id || undefined,
          analysisId: pi.metadata?.analysis_id || undefined,
          productName: pi.metadata?.product_name || undefined,
          description: pi.description || undefined,
        })
      }
      
      transactions.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      
      console.log('[Fetch Transactions] Returning', transactions.length, 'transactions by analysisId')
      
      return NextResponse.json({
        transactions: transactions,
        total: transactions.length,
      })
    }

    if (!customer) {
      // No customer found means no transactions
      console.log('[Fetch Transactions] No customer found for userId:', userId)
      return NextResponse.json({
        transactions: [],
        total: 0,
      })
    }

    console.log('[Fetch Transactions] Customer ID:', customer.id)

    // Fetch all PaymentIntents for this customer
    console.log('[Fetch Transactions] Fetching payment intents...')
    let paymentIntents
    try {
      paymentIntents = await stripe.paymentIntents.list({
        customer: customer.id,
        limit: 100,
      })
      console.log('[Fetch Transactions] Found', paymentIntents.data.length, 'payment intents')
    } catch (error: any) {
      console.error('[Fetch Transactions] Error listing payment intents:', error.message)
      throw new Error(`Failed to list payment intents: ${error.message}`)
    }

    // Fetch charges to get receipt URLs
    console.log('[Fetch Transactions] Fetching charges...')
    let charges
    try {
      charges = await stripe.charges.list({
        customer: customer.id,
        limit: 100,
      })
      console.log('[Fetch Transactions] Found', charges.data.length, 'charges')
    } catch (error: any) {
      console.error('[Fetch Transactions] Error listing charges:', error.message)
      throw new Error(`Failed to list charges: ${error.message}`)
    }

    // Create a map of payment intent ID to charge (for receipt URLs)
    const chargeMap = new Map<string, Stripe.Charge>()
    charges.data.forEach((charge) => {
      if (charge.payment_intent && typeof charge.payment_intent === 'string') {
        chargeMap.set(charge.payment_intent, charge)
      }
    })

    // Transform PaymentIntents to Transaction objects
    // Filter out incomplete PaymentIntents (not yet submitted by user)
    const incompleteStatuses = ['requires_payment_method', 'requires_confirmation']
    
    const transactions: Transaction[] = paymentIntents.data
      .filter((pi) => {
        // Only include PaymentIntents that have been submitted/processed
        // Exclude incomplete ones that were never submitted
        return !incompleteStatuses.includes(pi.status)
      })
      .map((pi) => {
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
          // Only mark as failed if it's actually a failed status
          // (shouldn't include incomplete statuses due to filter above)
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
          analysisId: pi.metadata?.analysis_id || undefined,
          productName: pi.metadata?.product_name || undefined,
          description: pi.description || undefined,
        }
      })

    // Sort by creation date (newest first)
    transactions.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    console.log('[Fetch Transactions] Returning', transactions.length, 'transactions')

    return NextResponse.json({
      transactions: transactions,
      total: transactions.length,
    })

  } catch (error: any) {
    console.error('[Fetch Transactions] Error:', error)
    console.error('[Fetch Transactions] Error stack:', error.stack)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch transactions',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

