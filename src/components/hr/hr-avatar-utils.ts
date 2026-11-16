/**
 * Employee avatars. A photo is shown only when someone uploaded one.
 * Otherwise the screen uses initials.
 */

import type { VentureEmployee } from './venture-employees-directory'

export function employeeInitials(name: string): string {
  const parts = name
    .replace(/[()]/g, ' ')
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  const letters = parts.slice(0, 2).map((part) => part[0] ?? '').join('')
  return letters || name.slice(0, 2) || '?'
}

const STORAGE_AVATARS_KEY = 'venture_hr_custom_avatars'
const STORAGE_DOCS_KEY = 'venture_hr_custom_docs'

export function loadCustomAvatars(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_AVATARS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveCustomAvatar(code: string, dataUrl: string): void {
  if (typeof window === 'undefined') return
  try {
    const current = loadCustomAvatars()
    current[code] = dataUrl
    localStorage.setItem(STORAGE_AVATARS_KEY, JSON.stringify(current))
    window.dispatchEvent(new CustomEvent('venture-avatar-updated', { detail: { code, dataUrl } }))
  } catch (err) {
    console.error('Failed to save avatar to localStorage:', err)
  }
}

export function saveCustomAvatarsBatch(updates: Record<string, string>): void {
  if (typeof window === 'undefined') return
  try {
    const current = loadCustomAvatars()
    const merged = { ...current, ...updates }
    localStorage.setItem(STORAGE_AVATARS_KEY, JSON.stringify(merged))
    window.dispatchEvent(new CustomEvent('venture-avatar-batch-updated', { detail: updates }))
  } catch (err) {
    console.error('Failed to batch save avatars:', err)
  }
}

export interface CustomEmployeeDoc {
  id: string
  nameAr: string
  nameEn: string
  fileName: string
  size: string
  uploadDate: string
  statusAr: string
  statusEn: string
  dataUrl?: string
}

export function loadCustomDocs(): Record<string, CustomEmployeeDoc[]> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_DOCS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, CustomEmployeeDoc[]>) : {}
  } catch {
    return {}
  }
}

export function saveCustomDocs(code: string, newDoc: CustomEmployeeDoc): void {
  if (typeof window === 'undefined') return
  try {
    const current = loadCustomDocs()
    const empDocs = current[code] || []
    current[code] = [newDoc, ...empDocs]
    localStorage.setItem(STORAGE_DOCS_KEY, JSON.stringify(current))
    window.dispatchEvent(new CustomEvent('venture-docs-updated', { detail: { code, newDoc } }))
  } catch (err) {
    console.error('Failed to save document:', err)
  }
}

/** Uploaded photo only. A missing photo returns null so the screen can show initials. */
export function getEmployeeAvatarUrl(
  emp: VentureEmployee,
  customMap: Record<string, string> = {},
): string | null {
  const uploaded = customMap[emp.code]
  return uploaded || null
}

export function compressImageFile(file: File, maxDim = 320, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new Image()
      img.onload = () => {
        let w = img.width
        let h = img.height
        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w)
            w = maxDim
          }
        } else if (h > maxDim) {
          w = Math.round((w * maxDim) / h)
          h = maxDim
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(ev.target?.result as string)
          return
        }
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = ev.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
