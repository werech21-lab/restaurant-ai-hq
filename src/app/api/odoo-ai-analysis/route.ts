import { NextRequest, NextResponse } from 'next/server'

/**
 * ==============================================================================
 * AETHERBI ERP — ODOO AI COMMAND CENTER BACKEND ENDPOINT
 * Model: claude-sonnet-5-5 / claude-3-7-sonnet
 * Features: Prompt Caching (90% Cost Reduction & Ultra-Low Latency)
 * ==============================================================================
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface OdooFinancialTelemetry {
  period: string
  netSalesKwd: number
  foodCostPct: number
  cogsKwd: number
  maintenanceKwd: number
  totalCustodiesKwd: number
  activeBranchesCount: number
  topAnomalies: Array<{
    branch: string
    issue: string
    varianceKwd: number
    severity: 'CRITICAL' | 'WARNING' | 'STABLE'
  }>
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        {
          error: 'MISSING_API_KEY',
          message: 'ANTHROPIC_API_KEY environment variable is not configured.',
        },
        { status: 500 }
      )
    }

    const payload: OdooFinancialTelemetry = await req.json()

    // 1. Large reusable System Prompt with Ephemeral Prompt Caching
    // Anthropic caches the system prompt block across queries, saving up to 90% of prompt tokens.
    const systemPrompt = `أنت المحرك الذكي الرئيسي (AI Core Engine) لمنصة AetherBI لشركة فنتشر فودز لإدارة المطاعم ذ.م.م. (ترخيص 2021/22838) في دولة الكويت.
تمتلك الشركة 6 علامات تجارية رسمية (تشاينا جاردن، فرانكس، شاورما طحينة، فارم براون، ذا نودل بار، كرك كافتيريا) و9 فروع نشطة ومطبخ مركزي بالقرين (مركز تكلفة وتموين).

قواعد التحليل المالي والرقابي الصارمة:
1. المبيعات المعتمدة للفترة: 167,092.160 د.ك.
2. بند الصيانة العامة للمطابخ والفروع (ربيع): 10,707.930 د.ك.
3. إجمالي العهد والمصروفات المدققة في أودو: 51,154.950 د.ك (سند 31,646.750 د.ك، الإقامات 14,912.800 د.ك، الضمان 6,945.000 د.ك، البلدية 1,778.000 د.ك).
4. المطبخ المركزي بالقرين مبيعاته 0.000 د.ك وهامشه 0.0% لأنه مركز تكلفة وليس منفذ بيع للجمهور.
5. استخرج التوصيات التنفيذية بدقة متناهية مع الأثر المالي المتوقع بالدينار الكويتي (KWD).`

    // 2. Request Anthropic API with Prompt Caching (Beta Header)
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5-5', // Fallback: claude-3-7-sonnet-20250219
        max_tokens: 3000,
        temperature: 0.1,
        system: [
          {
            type: 'text',
            text: systemPrompt,
            cache_control: { type: 'ephemeral' }, // 🚀 PROMPT CACHING ACTIVATION
          },
        ],
        messages: [
          {
            role: 'user',
            content: `إليك ملخص البيانات اللحظية المستخرجة من سجلات Odoo ERP:
${JSON.stringify(payload, null, 2)}

المطلوب:
1. تشخيص جنائي لأخطر 3 انحرافات مسجلة في الفروع.
2. 3 توصيات تنفيذية حاسمة ترفع الربحية الشهرية بتقدير مالي دقيق (+0.000 د.ك).
3. أعد النتائج بصيغة JSON مهيكلة تحتوي على: summary, alerts, recommendations.`,
          },
        ],
      }),
    })

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text()
      return NextResponse.json(
        { error: 'ANTHROPIC_UPSTREAM_ERROR', details: errText },
        { status: anthropicResponse.status }
      )
    }

    const data = await anthropicResponse.json()
    const contentBlock = data.content?.[0]?.text ?? ''

    return NextResponse.json({
      success: true,
      usage: data.usage, // Contains cache_creation_input_tokens & cache_read_input_tokens
      analysis: contentBlock,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: error?.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
