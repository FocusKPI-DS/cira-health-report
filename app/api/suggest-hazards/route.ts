import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  const { intended_use, hazards } = await req.json()

  if (!intended_use || !Array.isArray(hazards)) {
    return NextResponse.json({ error: 'Missing intended_use or hazards' }, { status: 400 })
  }

  const hazardList = hazards.map((h: string) => `- ${h}`).join('\n')

  const resp = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    messages: [
      {
        role: 'system',
        content: `You are an ISO 14971 medical device risk management expert. Given a device's intended use, identify which hazard categories from the provided list are applicable. Return ONLY a JSON object with key "suggested_hazards" containing an array of the applicable hazard strings, copied exactly from the list.`,
      },
      {
        role: 'user',
        content: `Intended use: ${intended_use}\n\nAvailable hazard categories:\n${hazardList}\n\nSelect all applicable hazard categories for this device based on its intended use.`,
      },
    ],
    response_format: { type: 'json_object' },
  })

  const raw = resp.choices[0].message.content ?? '{}'
  const result = JSON.parse(raw)

  return NextResponse.json({ suggested_hazards: result.suggested_hazards ?? [] })
}
