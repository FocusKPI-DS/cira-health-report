import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

interface FDAClassificationResult {
  device_name: string
  product_code: string
  regulation_number?: string
  device_class: string
  medical_specialty_description: string
  regulation_description?: string
  openfda?: {
    fda_document_id?: string[]
  }
}

interface FDAApiResponse {
  meta?: {
    results?: {
      total?: number
    }
  }
  results?: FDAClassificationResult[]
}

/**
 * Use OpenAI to get potential FDA product codes for a device name
 */
async function getProductCodesFromOpenAI(deviceName: string): Promise<{ productCodes: string[], rawResponse: string }> {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an FDA medical device classification expert. Provide accurate FDA product codes based on device names. Product codes are typically 3-letter codes like "PHP", "KPS", "MRY", etc.'
        },
        {
          role: 'user',
          content: `What are the most likely FDA product codes for "${deviceName}"? List up to 5 most relevant codes. Output only in JSON format: {"product_code":["CODE1","CODE2",...]}`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      return { productCodes: [], rawResponse: '' }
    }

    const parsed = JSON.parse(content)
    return {
      productCodes: parsed.product_code || [],
      rawResponse: content
    }
  } catch (error) {
    console.error('[OpenAI] Error getting product codes:', error)
    return { productCodes: [], rawResponse: '' }
  }
}

/**
 * Search FDA by product code
 */
async function searchFDAByProductCode(productCode: string): Promise<FDAClassificationResult[]> {
  try {
    const fdaApiUrl = `https://api.fda.gov/device/classification.json?search=product_code:${productCode}&limit=10`
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(fdaApiUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return []
    }

    const data: FDAApiResponse = await response.json()
    return data.results || []
  } catch (error) {
    console.error(`[FDA Search] Error searching product code ${productCode}:`, error)
    return []
  }
}

/**
 * Search FDA device classification database
 * Uses the openFDA device/classification endpoint
 * 
 * Query parameters:
 * - deviceName: The device name to search for (required)
 * - limit: Maximum number of results (default: 10, max: 100)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const deviceName = searchParams.get('deviceName')
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100)

    if (!deviceName || deviceName.trim() === '') {
      return NextResponse.json(
        { error: 'Device name is required' },
        { status: 400 }
      )
    }

    // Build the openFDA API URL
    // Search in device_name field using case-insensitive search
    const encodedDeviceName = encodeURIComponent(deviceName.trim())
    const fdaApiUrl = `https://api.fda.gov/device/classification.json?search=device_name:"${encodedDeviceName}"&limit=${limit}`

    console.log('[FDA Search] Searching for:', deviceName, '| URL:', fdaApiUrl)

    // Make request to FDA API
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

    try {
      const response = await fetch(fdaApiUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      })

      clearTimeout(timeoutId)

      let fdaResults: FDAClassificationResult[] = []
      let totalFromAPI: number | undefined = undefined

      if (!response.ok) {
        if (response.status === 404) {
          // No results found, will try OpenAI fallback below
          console.log('[FDA Search] 404 from direct search, will try OpenAI fallback')
        } else {
          throw new Error(`FDA API returned status ${response.status}`)
        }
      } else {
        const data: FDAApiResponse = await response.json()
        fdaResults = data.results || []
        totalFromAPI = data.meta?.results?.total
      }

      // Check if we have results, if not try OpenAI fallback
      let openaiResponse: string | undefined = undefined
      let dataSource: 'fda' | 'openai' = 'fda'
      
      if (fdaResults.length === 0) {
        console.log('[FDA Search] No results from direct search, trying OpenAI fallback')
        
        // Get product codes from OpenAI
        const { productCodes, rawResponse } = await getProductCodesFromOpenAI(deviceName)
        openaiResponse = rawResponse
        console.log('[OpenAI] Suggested product codes:', productCodes)
        
        if (productCodes.length > 0) {
          // Search FDA for each product code
          const searchPromises = productCodes.map(code => searchFDAByProductCode(code))
          const searchResults = await Promise.all(searchPromises)
          
          // Flatten and deduplicate results
          const allResults = searchResults.flat()
          const uniqueResults = Array.from(
            new Map(allResults.map(item => [item.product_code, item])).values()
          )
          
          fdaResults = uniqueResults
          if (fdaResults.length > 0) {
            dataSource = 'openai'
          }
        }
      }

      // Transform FDA results to our format
      const results = fdaResults.map((item, index) => {
        // Generate FDA classification link
        const regulationNumber = item.regulation_number || ''
        let fdaClassificationLink: string | undefined = undefined
        
        if (regulationNumber) {
          // Extract the part before decimal point (e.g., "880" from "880.5860")
          const partNumber = regulationNumber.split('.')[0]
          fdaClassificationLink = `https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-${partNumber}/subpart-F/section-${regulationNumber}`
        }

        return {
          id: `fda_${item.product_code}_${index}`,
          productCode: item.product_code,
          device: item.device_name,
          regulationDescription: item.regulation_description || item.device_name,
          medicalSpecialty: item.medical_specialty_description || 'General',
          deviceClass: item.device_class,
          regulationNumber: item.regulation_number,
          fdaClassificationLink,
        }
      })

      const responseData: any = {
        source: dataSource,
        results,
        total: totalFromAPI || results.length,
        query: deviceName
      }
      
      // Include OpenAI response for debugging if it was used
      if (openaiResponse) {
        responseData.openai_response = openaiResponse
      }
      
      return NextResponse.json(responseData)

    } catch (fetchError) {
      clearTimeout(timeoutId)
      
      if (fetchError instanceof Error) {
        if (fetchError.name === 'AbortError') {
          console.error('[FDA Search] Request timeout')
          return NextResponse.json(
            { error: 'FDA API request timeout' },
            { status: 504 }
          )
        }
      }
      
      throw fetchError
    }

  } catch (error) {
    console.error('[FDA Search] Error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to search FDA database',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
