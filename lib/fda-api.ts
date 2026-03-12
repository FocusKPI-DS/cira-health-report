/**
 * Fetches the MAUDE (Manufacturer and User Facility Device Experience) event count
 * for a given FDA product code from the public openFDA API.
 *
 * Returns 0 if no records are found or if an error occurs.
 */
export async function fetchMaudeCount(productCode: string): Promise<number> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_FDA_API_KEY
    const keyParam = apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : ''
    const url = `https://api.fda.gov/device/event.json?search=device.device_report_product_code:%22${encodeURIComponent(productCode)}%22&limit=1${keyParam}`
    const response = await fetch(url)
    const data = await response.json()
    if (data?.error) return 0
    return data?.meta?.results?.total ?? 0
  } catch {
    return 0
  }
}
