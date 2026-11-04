/**
 * Venture Foods HRMS — Employee Avatar & Media Asset Utilities
 * Supports persistent custom photo uploads, local caching, and realistic role-based studio portraits.
 */

import type { VentureEmployee } from './venture-employees-directory'

// Curated realistic role-based studio portraits (high quality, reliable, professional)
// Mapped by role category and demographic representation
const ROLE_STUDIO_AVATARS: Record<string, string[]> = {
  // Executive & Directors (Suits, formal corporate)
  executive_male: [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=face&q=80', // Ahmed Al-Ebrahim CEO
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&fit=crop&crop=face&q=80', // Ahmed Al-Abdulmohsen CMO
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&h=300&fit=crop&crop=face&q=80', // Hani Philip CFO
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&h=300&fit=crop&crop=face&q=80', // Zakaria Iskandar OPS Director
  ],
  executive_female: [
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&h=300&fit=crop&crop=face&q=80', // Sheyam Hekmat HR Manager
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=300&h=300&fit=crop&crop=face&q=80', // Zahraa Ali HR Assistant
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop&crop=face&q=80', // Nourhan El-Sayed Marketing
  ],
  // Executive Chef & Culinary Brigade
  chef_male: [
    'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=300&h=300&fit=crop&crop=face&q=80', // Alex Kaboul Executive Chef
    'https://images.unsplash.com/photo-1583394293214-28ded15ee548?w=300&h=300&fit=crop&crop=face&q=80', // Chef DCDP
    'https://images.unsplash.com/photo-1541614101331-1a5a3a194e92?w=300&h=300&fit=crop&crop=face&q=80', // Cook In Charge
    'https://images.unsplash.com/photo-1581299894007-aaa50297cf16?w=300&h=300&fit=crop&crop=face&q=80', // Asian Wok Chef
    'https://images.unsplash.com/photo-1595273670150-bd0c3c392e46?w=300&h=300&fit=crop&crop=face&q=80', // Central Kitchen Production Cook
  ],
  // Front-of-House Restaurant Crew & Supervisors
  crew_male: [
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&h=300&fit=crop&crop=face&q=80',
    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=300&h=300&fit=crop&crop=face&q=80',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&h=300&fit=crop&crop=face&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&h=300&fit=crop&crop=face&q=80',
  ],
  crew_female: [
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&h=300&fit=crop&crop=face&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&h=300&fit=crop&crop=face&q=80',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=300&h=300&fit=crop&crop=face&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&h=300&fit=crop&crop=face&q=80',
  ],
  // Finance & Accounting & Office Admin
  finance_admin: [
    'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=300&h=300&fit=crop&crop=face&q=80', // Abdullah Awirah Executive Secretary
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&h=300&fit=crop&crop=face&q=80', // Amgad Samir GRO
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=face&q=80', // Mohamed Al Saeed Chief Accountant
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&h=300&fit=crop&crop=face&q=80', // Samy Sabry Senior Accountant
  ],
  // Logistics & Warehouse & Drivers
  supply_drivers: [
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&fit=crop&crop=face&q=80',
    'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=300&h=300&fit=crop&crop=face&q=80',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&h=300&fit=crop&crop=face&q=80',
  ],
}

// Special assignment for key flagship employees
const FLAGSHIP_PORTRAITS: Record<string, string> = {
  // 2049: Abdullah Abdulghafar Awirah (Executive Secretary)
  '2049': 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=300&h=300&fit=crop&crop=face&q=80',
  // 2090: Abdelrahman Mohamed Gamaledin (Marketing Coordinator)
  '2090': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop&crop=face&q=80',
  // 01: Ahmed Al-Ebrahim (CEO)
  '01': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=face&q=80',
  // 02: Ahmed Al-Abdulmohsen (CMO)
  '02': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&fit=crop&crop=face&q=80',
  // VF106: Hani Philip (CFO)
  'VF106': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&h=300&fit=crop&crop=face&q=80',
  // 1715: Amgad Samir (GRO / Mandoob)
  '1715': 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&h=300&fit=crop&crop=face&q=80',
  // 2112: Shyam (HR & Admin)
  '2112': 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&h=300&fit=crop&crop=face&q=80',
  // 2113: Zahraa Ali (HR Assistant)
  '2113': 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=300&h=300&fit=crop&crop=face&q=80',
  // 2093: Alex Mohram Kaboul (Group Executive Chef)
  '2093': 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=300&h=300&fit=crop&crop=face&q=80',
  // 2111: Zakaria Iskandar (OPS Director)
  '2111': 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&h=300&fit=crop&crop=face&q=80',
  // 2091: Rabih Yehia (Asst Ops Manager)
  '2091': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&h=300&fit=crop&crop=face&q=80',
  // 1806: Samy Sabry (Accountant 1)
  '1806': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=face&q=80',
  // 1002: Ezzelarab Mohamed (Complimentary)
  '1002': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&fit=crop&crop=face&q=80',
  // 1832: Nader Nozhy (Purchasing Supervisor)
  '1832': 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=300&h=300&fit=crop&crop=face&q=80',
}

const STORAGE_AVATARS_KEY = 'venture_hr_custom_avatars'
const STORAGE_DOCS_KEY = 'venture_hr_custom_docs'

/**
 * Load user-uploaded avatars from localStorage
 */
export function loadCustomAvatars(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_AVATARS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

/**
 * Save user-uploaded avatar for an employee code
 */
export function saveCustomAvatar(code: string, dataUrl: string): void {
  if (typeof window === 'undefined') return
  try {
    const current = loadCustomAvatars()
    current[code] = dataUrl
    localStorage.setItem(STORAGE_AVATARS_KEY, JSON.stringify(current))
    // Dispatch custom event for real-time synchronization across components
    window.dispatchEvent(new CustomEvent('venture-avatar-updated', { detail: { code, dataUrl } }))
  } catch (err) {
    console.error('Failed to save avatar to localStorage:', err)
  }
}

/**
 * Save multiple avatars at once (batch auto-match sync)
 */
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

/**
 * Load custom attached documents from localStorage
 */
export function loadCustomDocs(): Record<string, any[]> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_DOCS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

/**
 * Save custom attached documents
 */
export function saveCustomDocs(code: string, newDoc: any): void {
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

/**
 * Get employee avatar photo URL:
 * 1. Checks user-uploaded custom avatar (localStorage/dataUrl)
 * 2. Checks flagship portrait map
 * 3. Fallbacks to realistic role-based studio portrait
 */
export function getEmployeeAvatarUrl(emp: VentureEmployee, customMap: Record<string, string> = {}): string {
  // 1. Custom uploaded photo
  if (customMap[emp.code]) {
    return customMap[emp.code]
  }

  // 2. Specific flagship portrait
  if (FLAGSHIP_PORTRAITS[emp.code]) {
    return FLAGSHIP_PORTRAITS[emp.code]
  }

  // 3. Deterministic index from employee code
  const numCode = parseInt(emp.code.replace(/\D/g, '') || '100', 10)

  // Female roles detection
  const isFemale =
    emp.nameEn.includes('Zahraa') ||
    emp.nameEn.includes('Sheyam') ||
    emp.nameEn.includes('Nourhan') ||
    emp.nameEn.includes('Sunita') ||
    emp.nameEn.includes('Sumitra') ||
    emp.nameEn.includes('Luletta') ||
    emp.nameEn.includes('Honey') ||
    emp.nameEn.includes('Jeanarose') ||
    emp.nameEn.includes('Mariany') ||
    emp.nameEn.includes('Arjane') ||
    emp.nameEn.includes('Anita') ||
    emp.nameEn.includes('Gita') ||
    emp.nameEn.includes('Pooja') ||
    emp.nameEn.includes('Dechen')

  if (isFemale) {
    if (emp.department.includes('HR') || emp.department.includes('Marketing')) {
      const arr = ROLE_STUDIO_AVATARS.executive_female
      return arr[numCode % arr.length]
    }
    const arr = ROLE_STUDIO_AVATARS.crew_female
    return arr[numCode % arr.length]
  }

  // Role based selection
  if (emp.department === 'Outside Partners / Executive') {
    const arr = ROLE_STUDIO_AVATARS.executive_male
    return arr[numCode % arr.length]
  }

  if (emp.department === 'Culinary Department' || emp.jobTitleEn.toLowerCase().includes('chef') || emp.jobTitleEn.toLowerCase().includes('cook')) {
    const arr = ROLE_STUDIO_AVATARS.chef_male
    return arr[numCode % arr.length]
  }

  if (emp.department === 'Finance Department' || emp.department === 'HR & Admin Department') {
    const arr = ROLE_STUDIO_AVATARS.finance_admin
    return arr[numCode % arr.length]
  }

  if (emp.department === 'Supply Chain Department' || emp.jobTitleEn.toLowerCase().includes('driver') || emp.jobTitleEn.toLowerCase().includes('warehouse')) {
    const arr = ROLE_STUDIO_AVATARS.supply_drivers
    return arr[numCode % arr.length]
  }

  // Operations crew default
  const arr = ROLE_STUDIO_AVATARS.crew_male
  return arr[numCode % arr.length]
}

/**
 * Resize and compress image to base64 Data URL
 */
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
        } else {
          if (h > maxDim) {
            w = Math.round((w * maxDim) / h)
            h = maxDim
          }
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
