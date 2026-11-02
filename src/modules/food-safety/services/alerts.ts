import { deliverWhatsApp } from '@/services/notification.service'
import { phoneDigits, waLink } from '@/lib/whatsapp'
import { logger } from '@/lib/logger'
import {
  EXCLUSIVE_RADAR_EMAILS,
  EXCLUSIVE_RADAR_MOBILES,
  EXCLUSIVE_RADAR_RECIPIENTS,
} from '@/lib/vf-contact-directory'
import { MAINTENANCE_CONTACT } from '@/modules/food-safety/domain/catalog'

export type FoodSafetyAlertDispatch = {
  kind: 'temp_critical' | 'spoilage' | 'vision_danger'
  siteNameEn: string
  siteNameAr: string
  detailEn: string
  detailAr: string
}

function assertExclusive(mobile: string, email: string): void {
  const digits = phoneDigits(mobile)
  const local = digits.startsWith('965') ? digits.slice(3) : digits
  if (!EXCLUSIVE_RADAR_MOBILES.has(local) && !EXCLUSIVE_RADAR_MOBILES.has(digits)) {
    throw new Error(`Food-safety alert blocked: mobile ${mobile}`)
  }
  if (!EXCLUSIVE_RADAR_EMAILS.has(email.trim().toLowerCase())) {
    throw new Error(`Food-safety alert blocked: email ${email}`)
  }
}

export function buildFoodSafetyAlertText(payload: FoodSafetyAlertDispatch): string {
  const kind =
    payload.kind === 'temp_critical'
      ? 'Critical Fridge Temperature'
      : payload.kind === 'vision_danger'
        ? 'AI Vision Spoilage Risk'
        : 'Verified Spoilage Disposal'
  return [
    '🚨 AetherBI · Venture Foods Food Safety',
    `Type: ${kind}`,
    `Branch: ${payload.siteNameEn} / ${payload.siteNameAr}`,
    payload.detailEn,
    payload.detailAr,
    `Maintenance: ${MAINTENANCE_CONTACT.name} ${MAINTENANCE_CONTACT.mobileDisplay}`,
  ].join('\n')
}

/** Dispatch to the three exclusive recipients only + maintenance WA deep-link. */
export async function dispatchFoodSafetyAlerts(payload: FoodSafetyAlertDispatch): Promise<{
  recipients: Array<{
    id: string
    name: string
    email: string
    mobile: string
    whatsapp: { ok: boolean; href: string; mode: string }
    telegram: { ok: boolean; href: string }
    emailChannel: { ok: boolean; href: string }
  }>
  maintenanceWa: string
}> {
  const text = buildFoodSafetyAlertText(payload)
  const recipients = []
  for (const r of EXCLUSIVE_RADAR_RECIPIENTS) {
    assertExclusive(r.mobile, r.email)
    let waOk = false
    try {
      const sent = await deliverWhatsApp(r.mobileE164, text)
      waOk = Boolean(sent?.ok)
    } catch (err) {
      logger.error('food_safety_alert_wa_failed', {
        recipientId: r.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
    const href = waLink(r.mobile, text)
    recipients.push({
      id: r.id,
      name: r.name,
      email: r.email,
      mobile: r.mobile,
      whatsapp: { ok: waOk, href, mode: 'link' },
      telegram: {
        ok: true,
        href: `https://t.me/share/url?url=${encodeURIComponent('https://www.aetherbi.com/erp/food-safety')}&text=${encodeURIComponent(text)}`,
      },
      emailChannel: {
        ok: true,
        href: `mailto:${r.email}?subject=${encodeURIComponent('AetherBI Food Safety Alert')}&body=${encodeURIComponent(text)}`,
      },
    })
  }
  return {
    recipients,
    maintenanceWa: waLink(
      MAINTENANCE_CONTACT.mobile,
      `Urgent fridge repair — ${payload.siteNameEn}: ${payload.detailEn}`,
    ),
  }
}
