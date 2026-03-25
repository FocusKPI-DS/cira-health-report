/**
 * Fetches the MAUDE event count for a given FDA product code from our internal database.
 * Falls back to 0 on error.
 */
export async function fetchMaudeCount(productCode: string, authHeaders?: Record<string, string>): Promise<number> {
  try {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const url = `${API_URL}/api/v1/anonclient/maude-count?product_code=${encodeURIComponent(productCode)}`
    const response = await fetch(url, { headers: authHeaders })
    if (!response.ok) return 0
    const data = await response.json()
    return data?.count ?? 0
  } catch {
    return 0
  }
}
