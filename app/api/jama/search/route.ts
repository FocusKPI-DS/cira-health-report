import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const count = parseInt(searchParams.get('count') || '10', 10)
  const journal = searchParams.get('journal') || 'JAMA'

  const apiKey = process.env.OPENALEX_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Missing OPENALEX_API_KEY in server env' }, { status: 500 })

  try {
    // 1) find the source id for the journal (e.g. JAMA)
    const srcUrl = `https://api.openalex.org/sources?filter=display_name.search:${encodeURIComponent(journal)}&per_page=1&api_key=${encodeURIComponent(apiKey)}`
    const srcRes = await fetch(srcUrl, { headers: { Accept: 'application/json' } })
    const srcJson = await srcRes.json()
    const source = srcJson.results?.[0]
    if (!source) return NextResponse.json({ error: `Journal source not found for ${journal}` }, { status: 404 })
    // source.id is like https://openalex.org/S172573765 -> short id is S172573765
    const sourceShort = (source.id || '').split('/').pop()
    if (!sourceShort) return NextResponse.json({ error: 'Unable to determine source id' }, { status: 500 })

    // Use recommended locations-based filter: primary_location.source.id:<SOURCE_ID>
    const filterStr = `primary_location.source.id:${sourceShort}`
    const baseWorks = `https://api.openalex.org/works?filter=${encodeURIComponent(filterStr)}&per_page=${encodeURIComponent(String(count))}&api_key=${encodeURIComponent(apiKey)}`
    const worksUrl = q ? `${baseWorks}&search=${encodeURIComponent(q)}` : baseWorks
    const worksRes = await fetch(worksUrl, { headers: { Accept: 'application/json' } })
    const worksJson = await worksRes.json()

    return NextResponse.json({ source, works: worksJson }, { status: 200 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
