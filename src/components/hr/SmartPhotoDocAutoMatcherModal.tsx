'use client'

import React, { useState, useRef, useEffect, useMemo } from 'react'
import {
  VENTURE_EMPLOYEES,
  type VentureEmployee,
} from './venture-employees-directory'
import {
  compressImageFile,
  saveCustomAvatarsBatch,
  saveCustomDocs,
} from './hr-avatar-utils'

export type DetectedDocType =
  | 'avatar'
  | 'civil_id'
  | 'passport'
  | 'work_permit'
  | 'health_card'
  | 'iban'
  | 'contract'
  | 'other_doc'

export interface ScannedMatchItem {
  id: string
  file: File
  fileName: string
  fileSize: string
  isImage: boolean
  previewUrl: string
  matchedEmployee: VentureEmployee | null
  matchConfidence: 'high' | 'medium' | 'none'
  matchReason: string
  docType: DetectedDocType
  excluded: boolean
}

interface SmartPhotoDocAutoMatcherModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (stats: { avatarsSaved: number; docsSaved: number }) => void
}

const DOC_TYPE_META: Record<
  DetectedDocType,
  { labelAr: string; labelEn: string; icon: string; color: string }
> = {
  avatar: {
    labelAr: 'صورة شخصية (Avatar)',
    labelEn: 'Profile Avatar Photo',
    icon: '👤',
    color: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  },
  civil_id: {
    labelAr: 'البطاقة المدنية (Civil ID)',
    labelEn: 'Kuwait Civil ID',
    icon: '🪪',
    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  passport: {
    labelAr: 'جواز السفر (Passport)',
    labelEn: 'Passport Copy',
    icon: '🛂',
    color: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  },
  work_permit: {
    labelAr: 'إذن العمل (Work Permit)',
    labelEn: 'PAM Work Permit',
    icon: '📜',
    color: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  health_card: {
    labelAr: 'الشهادة والكرت الصحي (Health Card)',
    labelEn: 'Baladiya Health Card',
    icon: '🩺',
    color: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  },
  iban: {
    labelAr: 'شهادة الآيبان البنكي (IBAN)',
    labelEn: 'Bank IBAN Certificate',
    icon: '💳',
    color: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
  },
  contract: {
    labelAr: 'عقد العمل الموثق (Contract)',
    labelEn: 'Employment Contract',
    icon: '📑',
    color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
  },
  other_doc: {
    labelAr: 'مستند رسمي إضافي (Other Doc)',
    labelEn: 'Other Official Document',
    icon: '📁',
    color: 'bg-gray-500/20 text-gray-300 border-gray-500/40',
  },
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * Intelligent file analysis engine:
 * Matches filenames to 166 Venture Foods employees by Badge ID and Name tokens.
 * Accurately classifies into Avatars or Official Documents.
 */
function analyzeFile(file: File): {
  matchedEmployee: VentureEmployee | null
  matchConfidence: 'high' | 'medium' | 'none'
  matchReason: string
  docType: DetectedDocType
} {
  const name = file.name.toLowerCase()
  const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|bmp|gif)$/i.test(name)

  // 1. Determine Document Type from keywords
  let docType: DetectedDocType = isImage ? 'avatar' : 'other_doc'

  if (/(civil|بطاق|مدني|hawya|cid)/i.test(name)) {
    docType = 'civil_id'
  } else if (/(passport|جواز|safari)/i.test(name)) {
    docType = 'passport'
  } else if (/(work_permit|work-permit|إذن|اذن|تصريح|iqama|إقام|اقام|residency|pam)/i.test(name)) {
    docType = 'work_permit'
  } else if (/(health|بلدي|صحي|medical|baladiya|kart)/i.test(name)) {
    docType = 'health_card'
  } else if (/(iban|آيبان|ايبان|bank|بنك|hesab|account)/i.test(name)) {
    docType = 'iban'
  } else if (/(contract|عقد|tawzeef|agreement)/i.test(name)) {
    docType = 'contract'
  } else if (isImage && /(avatar|photo|صورة|صوره|profile|headshot|portrait)/i.test(name)) {
    docType = 'avatar'
  }

  // 2. Exact or Word-Boundary Badge ID Match
  // Check against all employee codes (e.g. 2049, 2090, 1715, 01, 02, VF106)
  for (const emp of VENTURE_EMPLOYEES) {
    const code = emp.code.toLowerCase()
    // Pattern matches code surrounded by non-alphanumeric or start/end
    const regex = new RegExp(`(^|[^a-z0-9])${code}([^a-z0-9]|$)`, 'i')
    if (regex.test(name)) {
      return {
        matchedEmployee: emp,
        matchConfidence: 'high',
        matchReason: `رقم البصمة #${emp.code} (Badge ID)`,
        docType,
      }
    }
  }

  // 3. Normalized Fuzzy Name Matching
  // Tokenize filename and compare against employee names
  const cleanTokens = name
    .replace(/\.[^/.]+$/, '') // strip extension
    .split(/[\s_\-.,()+]+/)
    .filter((t) => t.length >= 3 && !['avatar', 'photo', 'image', 'picture', 'scan', 'copy', 'final', 'doc', 'pdf'].includes(t))

  let bestMatch: VentureEmployee | null = null
  let bestScore = 0
  let matchReason = ''

  for (const emp of VENTURE_EMPLOYEES) {
    const enTokens = emp.nameEn.toLowerCase().split(/\s+/).filter((t) => t.length >= 3)
    const arTokens = emp.nameAr.split(/\s+/).filter((t) => t.length >= 3)

    let score = 0
    let matchedTokenStr = ''

    for (const token of cleanTokens) {
      // Check English tokens
      for (const enT of enTokens) {
        if (enT === token) {
          score += 10
          matchedTokenStr = enT
        } else if (token.length >= 4 && (enT.startsWith(token) || token.startsWith(enT))) {
          score += 5
          matchedTokenStr = enT
        }
      }

      // Check Arabic tokens
      for (const arT of arTokens) {
        if (arT === token || (token.length >= 4 && arT.includes(token))) {
          score += 10
          matchedTokenStr = arT
        }
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestMatch = emp
      matchReason = `تطابق الاسم: ${matchedTokenStr}`
    }
  }

  if (bestMatch && bestScore >= 10) {
    return {
      matchedEmployee: bestMatch,
      matchConfidence: bestScore >= 15 ? 'high' : 'medium',
      matchReason,
      docType,
    }
  }

  return {
    matchedEmployee: null,
    matchConfidence: 'none',
    matchReason: 'لم يتم التعرف التلقائي على الموظف',
    docType,
  }
}

export function SmartPhotoDocAutoMatcherModal({
  isOpen,
  onClose,
  onSuccess,
}: SmartPhotoDocAutoMatcherModalProps) {
  const [items, setItems] = useState<ScannedMatchItem[]>([])
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'AVATARS' | 'DOCS' | 'UNMATCHED'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progressText, setProgressText] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null)

  // Dedicated refs for Folder Input vs Multiple Files Input
  const folderInputRef = useRef<HTMLInputElement>(null)
  const filesInputRef = useRef<HTMLInputElement>(null)

  // Critical Windows Folder Picker fix:
  // Dynamically set webkitdirectory on the folder input without having accept attribute
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute('webkitdirectory', '')
      folderInputRef.current.setAttribute('directory', '')
    }
  }, [isOpen])

  const handleFiles = (fileList: FileList | File[]) => {
    const rawFiles = Array.from(fileList)
    if (rawFiles.length === 0) return

    const newItems: ScannedMatchItem[] = rawFiles.map((file, idx) => {
      const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|bmp|gif)$/i.test(file.name)
      const previewUrl = isImage ? URL.createObjectURL(file) : ''
      const analysis = analyzeFile(file)

      return {
        id: `scanned-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        file,
        fileName: file.name,
        fileSize: formatBytes(file.size),
        isImage,
        previewUrl,
        matchedEmployee: analysis.matchedEmployee,
        matchConfidence: analysis.matchConfidence,
        matchReason: analysis.matchReason,
        docType: analysis.docType,
        excluded: false,
      }
    })

    setItems((prev) => [...prev, ...newItems])
    setSaveSuccessMsg(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }

  const handleUpdateItemEmployee = (itemId: string, empCode: string) => {
    const emp = VENTURE_EMPLOYEES.find((e) => e.code === empCode) || null
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? {
              ...it,
              matchedEmployee: emp,
              matchConfidence: emp ? 'high' : 'none',
              matchReason: emp ? 'تم التحديد يدوياً' : 'غير محدد',
            }
          : it
      )
    )
  }

  const handleUpdateItemDocType = (itemId: string, docType: DetectedDocType) => {
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, docType } : it))
    )
  }

  const handleToggleExclude = (itemId: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, excluded: !it.excluded } : it))
    )
  }

  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((it) => it.id !== itemId))
  }

  const handleClearAll = () => {
    items.forEach((it) => {
      if (it.previewUrl) URL.revokeObjectURL(it.previewUrl)
    })
    setItems([])
    setSaveSuccessMsg(null)
  }

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      if (activeFilter === 'AVATARS' && it.docType !== 'avatar') return false
      if (activeFilter === 'DOCS' && it.docType === 'avatar') return false
      if (activeFilter === 'UNMATCHED' && it.matchedEmployee !== null) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesName = it.fileName.toLowerCase().includes(q)
        const matchesEmp =
          it.matchedEmployee &&
          (it.matchedEmployee.nameAr.toLowerCase().includes(q) ||
            it.matchedEmployee.nameEn.toLowerCase().includes(q) ||
            it.matchedEmployee.code.toLowerCase().includes(q))
        if (!matchesName && !matchesEmp) return false
      }
      return true
    })
  }, [items, activeFilter, searchQuery])

  // Summary counts
  const totalCount = items.length
  const matchedCount = items.filter((it) => it.matchedEmployee && !it.excluded).length
  const avatarCount = items.filter((it) => it.matchedEmployee && it.docType === 'avatar' && !it.excluded).length
  const docCount = items.filter((it) => it.matchedEmployee && it.docType !== 'avatar' && !it.excluded).length
  const unmatchedCount = items.filter((it) => !it.matchedEmployee && !it.excluded).length

  // Execute confirm and sync
  const handleConfirmAndSync = async () => {
    const readyItems = items.filter((it) => it.matchedEmployee && !it.excluded)
    if (readyItems.length === 0) {
      alert('لا توجد ملفات مطابقة لموظفين لحفظها. يرجى مطابقة الموظف لكل ملف أولاً.')
      return
    }

    setIsProcessing(true)
    setProgressText('جاري معالجة وضغط الصور والمستندات...')

    try {
      const avatarUpdates: Record<string, string> = {}
      let avatarsSaved = 0
      let docsSaved = 0

      for (let i = 0; i < readyItems.length; i++) {
        const it = readyItems[i]
        const emp = it.matchedEmployee!
        setProgressText(`معالجة ${i + 1} من ${readyItems.length}: ${it.fileName}`)

        if (it.docType === 'avatar' && it.isImage) {
          // Compress avatar to clean webp/jpeg to fit localStorage
          const compressed = await compressImageFile(it.file, 320, 0.85)
          avatarUpdates[emp.code] = compressed
          avatarsSaved++
        } else {
          // Process document: convert to DataURL & store in customDocs
          const reader = new FileReader()
          const dataUrl = await new Promise<string>((res) => {
            reader.onload = () => res(reader.result as string)
            reader.onerror = () => res('')
            reader.readAsDataURL(it.file)
          })

          if (dataUrl) {
            const meta = DOC_TYPE_META[it.docType]
            const newDoc = {
              id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              nameAr: meta.labelAr,
              nameEn: meta.labelEn,
              fileName: it.fileName,
              size: it.fileSize,
              uploadDate: new Date().toISOString().slice(0, 10),
              statusAr: 'مؤرشف رقمياً',
              statusEn: 'Digitally Archived',
              dataUrl,
              docType: it.docType,
            }
            saveCustomDocs(emp.code, newDoc)
            docsSaved++
          }
        }
      }

      // Batch save avatars
      if (Object.keys(avatarUpdates).length > 0) {
        saveCustomAvatarsBatch(avatarUpdates)
      }

      setSaveSuccessMsg(
        `تم بنجاح استيراد ومزامنة ${avatarsSaved} صورة شخصية و ${docsSaved} مستند رسمي للموظفين!`
      )
      if (onSuccess) {
        onSuccess({ avatarsSaved, docsSaved })
      }
    } catch (err) {
      console.error('Error during auto-match sync:', err)
      alert('حدث خطأ أثناء حفظ الملفات. يرجى التحقق من حجم الملفات.')
    } finally {
      setIsProcessing(false)
      setProgressText('')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-2 sm:p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative flex max-h-[94vh] w-full max-w-5xl flex-col rounded-3xl border border-white/15 bg-[#0b0f17] text-white shadow-2xl"
        dir="rtl"
      >
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/30 text-xl shadow-inner">
              📸
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">
                  محرك المطابقة التلقائية لصور وأوراق الموظفين
                </h2>
                <span className="rounded-lg bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-300 border border-amber-500/30">
                  Auto-Matcher AI
                </span>
              </div>
              <p className="text-xs text-mist-400">
                استيراد مجلد كامل أو ملفات متعددة ومطابقتها فورياً ببيانات 166 موظفاً عبر رقم البصمة والاسم
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-sm font-bold text-mist-300 hover:bg-white/15 hover:text-white transition-colors"
              aria-label="إغلاق"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Success Alert Banner */}
        {saveSuccessMsg ? (
          <div className="bg-emerald-950/80 border-b border-emerald-500/40 px-6 py-3 text-xs font-bold text-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">✅</span>
              <span>{saveSuccessMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setSaveSuccessMsg(null)}
              className="text-emerald-300 hover:text-white"
            >
              ✕
            </button>
          </div>
        ) : null}

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 1. SELECTION & DROPZONE HERO */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative rounded-3xl border-2 border-dashed p-6 text-center transition-all ${
              isDragOver
                ? 'border-amber-400 bg-amber-500/10 scale-[1.01]'
                : 'border-white/15 bg-[#121824]/60 hover:border-white/30'
            }`}
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-3xl shadow-inner mb-3">
              📁
            </div>

            <h3 className="text-base font-black text-white">
              اختر مجلداً كاملاً من الكمبيوتر أو اسحب وأفلت الملفات هنا
            </h3>
            <p className="text-xs text-mist-400 max-w-xl mx-auto mt-1 mb-5">
              يدعم النظام صور الموظفين الشخصية (JPG, PNG, WEBP) والمستندات الرسمية (PDF, Word) ويقوم تلقائياً
              بالتعرف على الموظف ونوع المستند من اسم الملف.
            </p>

            {/* Hidden native inputs */}
            {/* 1. Folder picker: NO accept attribute to avoid Windows opening standard file picker */}
            <input
              ref={folderInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files)
                e.target.value = ''
              }}
            />

            {/* 2. Multiple files picker: Has accept for direct file selection */}
            <input
              ref={filesInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files)
                e.target.value = ''
              }}
            />

            {/* Trigger buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.multiple = true
                  input.setAttribute('webkitdirectory', '')
                  input.setAttribute('directory', '')
                  input.setAttribute('mozdirectory', '')
                  input.onchange = (ev: Event) => {
                    const target = ev.target as HTMLInputElement
                    const files = Array.from(target.files || [])
                    if (files.length > 0) handleFiles(files)
                  }
                  input.click()
                }}
                className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-5 py-3 text-xs font-black text-white shadow-lg hover:bg-sky-500 transition-all hover:scale-105"
              >
                <span>📂</span>
                <span>فتح الكمبيوتر لاختيار مجلد كامل (Select Full Folder)</span>
              </button>

              <button
                type="button"
                onClick={() => filesInputRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-xs font-black text-white hover:bg-white/20 transition-all hover:scale-105"
              >
                <span>📑</span>
                <span>اختيار ملفات وصور متعددة (Select Multiple Files)</span>
              </button>

              {items.length > 0 ? (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="inline-flex items-center gap-1.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-300 hover:bg-rose-500/20"
                >
                  <span>🗑️</span>
                  <span>إفراغ القائمة</span>
                </button>
              ) : null}
            </div>
          </div>

          {/* 2. SCANNED ITEMS SUMMARY CARDS */}
          {items.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="rounded-2xl border border-white/10 bg-[#121824] p-3 text-center">
                <span className="text-xs text-mist-400 font-bold block">إجمالي الملفات</span>
                <span className="text-xl font-black text-white">{totalCount}</span>
              </div>
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
                <span className="text-xs text-emerald-300 font-bold block">تطابق ناجح</span>
                <span className="text-xl font-black text-emerald-400">{matchedCount}</span>
              </div>
              <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3 text-center">
                <span className="text-xs text-sky-300 font-bold block">صور شخصية (Avatars)</span>
                <span className="text-xl font-black text-sky-400">{avatarCount}</span>
              </div>
              <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-3 text-center">
                <span className="text-xs text-purple-300 font-bold block">مستندات رسمية (Vault)</span>
                <span className="text-xl font-black text-purple-400">{docCount}</span>
              </div>
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-center col-span-2 sm:col-span-1">
                <span className="text-xs text-amber-300 font-bold block">بحاجة لمراجعة</span>
                <span className="text-xl font-black text-amber-400">{unmatchedCount}</span>
              </div>
            </div>
          ) : null}

          {/* 3. FILTER & SEARCH TOOLBAR */}
          {items.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-y border-white/10 py-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveFilter('ALL')}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    activeFilter === 'ALL'
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'border border-white/10 bg-white/5 text-mist-300 hover:text-white'
                  }`}
                >
                  الكل ({totalCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('AVATARS')}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    activeFilter === 'AVATARS'
                      ? 'bg-sky-500 text-white shadow-md'
                      : 'border border-white/10 bg-white/5 text-mist-300 hover:text-white'
                  }`}
                >
                  👤 صور شخصية ({avatarCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('DOCS')}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    activeFilter === 'DOCS'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'border border-white/10 bg-white/5 text-mist-300 hover:text-white'
                  }`}
                >
                  📂 أوراق رسمية ({docCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('UNMATCHED')}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                    activeFilter === 'UNMATCHED'
                      ? 'bg-amber-500 text-black shadow-md'
                      : 'border border-white/10 bg-white/5 text-mist-300 hover:text-white'
                  }`}
                >
                  ⚠️ غير مطابقة ({unmatchedCount})
                </button>
              </div>

              <div className="relative min-w-[220px]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث باسم الملف أو الموظف..."
                  className="w-full rounded-xl border border-white/15 bg-[#141b26] px-3 py-1.5 text-xs text-white placeholder-mist-400 focus:border-amber-400 focus:outline-none"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-mist-400 hover:text-white"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* 4. ITEMS LIST PREVIEW */}
          {filteredItems.length > 0 ? (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {filteredItems.map((it) => {
                const meta = DOC_TYPE_META[it.docType]
                return (
                  <div
                    key={it.id}
                    className={`flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border p-4 transition-all ${
                      it.excluded
                        ? 'border-white/5 bg-white/[0.02] opacity-50'
                        : it.matchedEmployee
                        ? 'border-white/10 bg-[#121824] hover:border-white/20'
                        : 'border-amber-500/30 bg-amber-500/5'
                    }`}
                  >
                    {/* File Thumbnail & Meta */}
                    <div className="flex items-center gap-3">
                      {it.isImage && it.previewUrl ? (
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-black shadow-md">
                          <img
                            src={it.previewUrl}
                            alt={it.fileName}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 border border-purple-500/30 text-2xl">
                          {meta.icon}
                        </div>
                      )}

                      <div className="space-y-1">
                        <p className="font-mono text-xs font-bold text-white max-w-sm truncate" dir="ltr">
                          {it.fileName}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-mist-400">{it.fileSize}</span>
                          <span
                            className={`rounded-md border px-2 py-0.5 text-xs font-bold ${
                              it.matchConfidence === 'high'
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : it.matchConfidence === 'medium'
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            }`}
                          >
                            {it.matchReason}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Matched Employee Picker & Document Type Selector */}
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Employee Dropdown */}
                      <div className="min-w-[210px]">
                        <label className="block text-[9px] font-bold text-mist-400 mb-1">
                          الموظف المطابق:
                        </label>
                        <select
                          value={it.matchedEmployee?.code || ''}
                          onChange={(e) => handleUpdateItemEmployee(it.id, e.target.value)}
                          className={`w-full rounded-xl border px-3 py-1.5 text-xs focus:outline-none ${
                            it.matchedEmployee
                              ? 'border-emerald-500/40 bg-[#162030] text-emerald-200 font-bold'
                              : 'border-amber-400/50 bg-amber-950/40 text-amber-300 font-bold'
                          }`}
                        >
                          <option value="">-- اختر موظفاً يدوياً --</option>
                          {VENTURE_EMPLOYEES.map((emp) => (
                            <option key={emp.id} value={emp.code}>
                              #{emp.code} — {emp.nameAr} ({emp.jobTitleAr})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Type Dropdown */}
                      <div className="min-w-[170px]">
                        <label className="block text-[9px] font-bold text-mist-400 mb-1">
                          تصنيف الملف:
                        </label>
                        <select
                          value={it.docType}
                          onChange={(e) =>
                            handleUpdateItemDocType(it.id, e.target.value as DetectedDocType)
                          }
                          className="w-full rounded-xl border border-white/15 bg-[#162030] px-3 py-1.5 text-xs text-white focus:outline-none"
                        >
                          <option value="avatar">👤 صورة شخصية (Avatar)</option>
                          <option value="civil_id">🪪 البطاقة المدنية (Civil ID)</option>
                          <option value="passport">🛂 جواز السفر (Passport)</option>
                          <option value="work_permit">📜 إذن العمل (Work Permit)</option>
                          <option value="health_card">🩺 كرت الصحة (Health Card)</option>
                          <option value="iban">💳 شهادة الآيبان (IBAN)</option>
                          <option value="contract">📑 عقد العمل (Contract)</option>
                          <option value="other_doc">📁 مستند آخر (Other Doc)</option>
                        </select>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 pt-4">
                        <button
                          type="button"
                          onClick={() => handleToggleExclude(it.id)}
                          className={`rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-all ${
                            it.excluded
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                              : 'border-white/15 bg-white/5 text-mist-300 hover:text-white'
                          }`}
                          title={it.excluded ? 'إلغاء الاستبعاد' : 'استبعاد هذا الملف'}
                        >
                          {it.excluded ? 'إعادة' : 'استبعاد'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(it.id)}
                          className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-1.5 text-rose-300 hover:bg-rose-500/20"
                          title="حذف من القائمة"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : items.length > 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#121824] p-8 text-center text-mist-400 text-xs">
              لا توجد ملفات تطابق الفلتر الحالي.
            </div>
          ) : null}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#121824]/60 px-6 py-4">
          <div className="flex items-center gap-2 text-xs text-mist-300">
            {isProcessing ? (
              <div className="flex items-center gap-2 text-amber-300 font-bold animate-pulse">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" />
                <span>{progressText}</span>
              </div>
            ) : items.length > 0 ? (
              <span>
                جاهز للمزامنة: <strong className="text-white">{matchedCount}</strong> ملفاً مطابقاً لموظفي شركة فنتشر فودز.
              </span>
            ) : (
              <span>يرجى اختيار مجلد أو ملفات من جهاز الكمبيوتر للبدء.</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold text-mist-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              إلغاء
            </button>

            <button
              type="button"
              onClick={handleConfirmAndSync}
              disabled={isProcessing || matchedCount === 0}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black shadow-lg transition-all ${
                isProcessing || matchedCount === 0
                  ? 'bg-emerald-800/40 text-mist-400 cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500 hover:scale-105 shadow-emerald-950/40'
              }`}
            >
              <span>💾</span>
              <span>اعتماد ومزامنة كافة الملفات المطابقة ({matchedCount})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
