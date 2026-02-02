import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const href = searchParams.get('href')
  if (!href) return NextResponse.json({ error: 'Missing href parameter' }, { status: 400 })

  try {
    const allowedHost = 'api.elsevier.com'
    const u = new URL(href)
    if (u.hostname !== allowedHost) {
      return NextResponse.json({ error: 'Forbidden host' }, { status: 403 })
    }

    const apiKey = process.env.ELS_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Missing server ELS_API_KEY environment variable' }, { status: 500 })

    const res = await fetch(href, {
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
