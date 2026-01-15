import { NextRequest, NextResponse } from 'next/server'

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

      if (!response.ok) {
        if (response.status === 404) {
          // No results found
          return NextResponse.json({
            results: [],
            total: 0,
            query: deviceName
          })
        }
        
        throw new Error(`FDA API returned status ${response.status}`)
      }

      const data: FDAApiResponse = await response.json()

      // Transform FDA results to our format
      const results = (data.results || []).map((item, index) => {
        // Generate FDA classification link
        const regulationNumber = item.regulation_number || ''
        const fdaClassificationLink = regulationNumber
          ? `https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm?FR=${regulationNumber}`
          : undefined

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

      return NextResponse.json({
        results,
        total: data.meta?.results?.total || results.length,
        query: deviceName
      })

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
