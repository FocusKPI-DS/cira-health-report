import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const count = searchParams.get('count') || searchParams.get('rows') || '5'
  const start = searchParams.get('start') || '0'
  const org = searchParams.get('org') || searchParams.get('organization')
  const id = searchParams.get('id')

  const apiKey = process.env.DATA_GOV_API_KEY
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (apiKey) headers['X-Api-Key'] = apiKey

  try {
    // If an explicit package id is provided, call package_show
    if (id) {
      const url = `https://catalog.data.gov/api/3/action/package_show?id=${encodeURIComponent(id)}`
      const res = await fetch(url, { headers })
      const json = await res.json()
      return NextResponse.json(json, { status: res.status })
    }

    // Build package_search; allow optional org filter
    const fq = org ? `&fq=${encodeURIComponent(`organization:${org}`)}` : ''
    const url = `https://catalog.data.gov/api/3/action/package_search?q=${encodeURIComponent(
      q
    )}${fq}&rows=${encodeURIComponent(count)}&start=${encodeURIComponent(start)}`

    const res = await fetch(url, { headers })
    const json = await res.json()

    // Normalize to { count, results }
    const normalized = {
      count: json?.result?.count ?? 0,
      results: json?.result?.results ?? [],
    }

    return NextResponse.json(normalized, { status: res.status })
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

