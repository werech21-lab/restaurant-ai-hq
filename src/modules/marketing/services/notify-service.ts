import { logger } from '@/lib/logger'
import { buildTrialAlertMessage } from '@/modules/marketing/domain/notify'

async function postJson(url: string, body: unknown, headers: Record<string, string>): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`notify_failed_${response.status}:${text.slice(0, 200)}`)
  }
}

/** Best-effort Telegram + WhatsApp alerts. Missing credentials are skipped, never thrown to the visitor. */
export async function notifyManagersOfTrialLead(input: {
  fullName: string
  phone: string
  companyName?: string | null
  leadId: string
  customerId: string
}): Promise<{ telegram: boolean; whatsapp: boolean }> {
  const text = buildTrialAlertMessage(input)
  let telegram = false
  let whatsapp = false

  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim()
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim()
  if (botToken && chatId) {
    try {
      await postJson(`https://api.telegram.org/bot${botToken}/sendMessage`, { chat_id: chatId, text }, {})
      telegram = true
    } catch (error) {
      logger.error('Telegram trial alert failed', { leadId: input.leadId, error: error instanceof Error ? error.message : String(error) })
    }
  }

  const waToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim()
  const waPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  const waTo = process.env.WHATSAPP_MANAGER_PHONE?.trim()
  if (waToken && waPhoneId && waTo) {
    try {
      await postJson(
        `https://graph.facebook.com/v21.0/${waPhoneId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: waTo.replace(/\D/g, ''),
          type: 'text',
          text: { body: text },
        },
        { Authorization: `Bearer ${waToken}` },
      )
      whatsapp = true
    } catch (error) {
      logger.error('WhatsApp trial alert failed', { leadId: input.leadId, error: error instanceof Error ? error.message : String(error) })
    }
  }

  if (!telegram && !whatsapp) {
    logger.info('Trial lead captured without outbound notify credentials', { leadId: input.leadId })
  }
  return { telegram, whatsapp }
}
