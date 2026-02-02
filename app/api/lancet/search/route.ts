import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || 'SRCTITLE(lancet)'
  const count = searchParams.get('count') || '10'

  const apiKey = process.env.ELS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing server ELS_API_KEY environment variable' }, { status: 500 })
  }

  const url = `https://api.elsevier.com/content/search/scopus?query=${encodeURIComponent(q)}&count=${encodeURIComponent(count)}`

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'X-ELS-APIKey': apiKey,
      },
    })

    const text = await res.text()
    const json = text ? JSON.parse(text) : {}
    return NextResponse.json(json, { status: res.status })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
