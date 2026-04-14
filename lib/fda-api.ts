/**
 * Fetches the MAUDE event count for a given FDA product code from our internal database.
 * Falls back to 0 on error.
 */
export async function fetchMaudeCount(
  productCode: string,
  startDate: string,
  endDate: string,
  authHeaders?: Record<string, string>
): Promise<number> {
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const url = `${API_URL}/api/v1/anonclient/maude-count?product_code=${encodeURIComponent(productCode)}&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`
    const response = await fetch(url, { headers: authHeaders })
    if (!response.ok) return 0
    const data = await response.json()
    return data?.count ?? 0
  } catch {
    return 0
  }
}

/**
 * Batch fetch MAUDE counts for multiple product codes.
 * Returns a map of product code to count.
 */
export async function fetchMaudeCountsBatch(
  productCodes: string[],
  startDate: string,
  endDate: string,
  authHeaders?: Record<string, string>
): Promise<Record<string, number>> {
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const url = `${API_URL}/api/v1/anonclient/maude-counts`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_codes: productCodes,
        start_date: startDate,
        end_date: endDate,
      }),
    })
    if (!response.ok) return {}
    const data = await response.json()
    return data ?? {}
  } catch {
    return {}
  }
}
