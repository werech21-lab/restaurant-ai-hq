import { NextResponse, type NextRequest } from 'next/server'
import { errorResponse } from '@/lib/api/errors'
import { toErrorResponse } from '@/lib/api/route'
import { telemetrySchema } from '@/modules/food-safety/schemas/food-safety'
import { ingestTelemetry } from '@/modules/food-safety'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * IoT webhook — Wi-Fi / BLE fridge sensors POST every ~5 minutes.
 * Optional lock: set FOOD_SAFETY_TELEMETRY_KEY and send `X-Telemetry-Key` or `Authorization: Bearer …`.
 */
export async function POST(request: NextRequest) {
  try {
    const expected = process.env.FOOD_SAFETY_TELEMETRY_KEY?.trim()
    if (expected) {
      const header = request.headers.get('x-telemetry-key') ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
      if (!header || header !== expected) {
        return errorResponse(401, 'unauthorized', 'Invalid telemetry key.')
      }
    }
    const body = telemetrySchema.parse(await request.json())
    const result = await ingestTelemetry(body)
    return NextResponse.json({ data: result }, { status: 201 })
  } catch (error) {
    return toErrorResponse(error, request)
  }
}
