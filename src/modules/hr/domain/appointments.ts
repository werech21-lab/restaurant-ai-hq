import { DomainError } from '@/lib/domain-error'

export const appointmentSlots = ['08:00-08:30', '09:00-09:30', '10:00-10:30', '11:00-11:30', '12:00-12:30', '13:00-13:30'] as const
export const appointmentTypes = ['passport_handover', 'equipment_clearance', 'contract_signing', 'salary_certificate', 'residency_renewal'] as const
export const appointmentDirections = ['pickup_from_hq', 'deliver_to_hq'] as const

export function appointmentTransition(status: string, action: 'confirm' | 'complete' | 'miss'): string {
  if (action === 'confirm' && status === 'booked') return 'confirmed'
  if (action === 'complete' && status === 'confirmed') return 'completed_handover'
  if (action === 'miss' && (status === 'booked' || status === 'confirmed')) return 'missed_appointment'
  throw new DomainError('invalid_transition', 'هذا الانتقال غير مسموح في الموعد.')
}
