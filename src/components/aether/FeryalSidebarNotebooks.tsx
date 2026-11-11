'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Check,
  Download,
  FolderInput,
  FolderPlus,
  Pencil,
  Pin,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { SlidingPillTabs } from '@/components/ui/SlidingPillTabs'
import {
  createNotebook,
  deleteChat,
  deleteNotebook,
  exportFeryalWorkspaceJson,
  FERYAL_CHATS_UPDATED_EVENT,
  filterAndGroupChats,
  getChatIndexSync,
  getNotebooksSync,
  hydrateFeryalChatStore,
  importFeryalWorkspaceJson,
  moveChatToNotebook,
  renameChat,
  renameNotebook,
  togglePinChat,
  type FeryalChatSummary,
  type FeryalNotebook,
} from '@/lib/feryal-chat-store'
import type { GlobalWorkspaceSlice } from '@/lib/aether/global-filter-engine'

export interface FeryalSidebarNotebooksProps {
  isAr: boolean
  activeChatId: string
  activeNotebookId: string
  onSelectNotebook: (notebookId: string) => void
  onSelectChat: (chatId: string) => void
  onNewChat: () => void
  workspace: GlobalWorkspaceSlice
  isCopilotThinking: boolean
  onRunNotePrompt: (prompt: string) => void
  panelClassName: string
}

export function FeryalSidebarNotebooks({
  isAr,
  activeChatId,
  activeNotebookId,
  onSelectNotebook,
  onSelectChat,
  onNewChat,
  workspace,
  isCopilotThinking,
  onRunNotePrompt,
  panelClassName,
}: FeryalSidebarNotebooksProps) {
  const [tab, setTab] = useState<'chats' | 'notes'>('chats')
  const [chats, setChats] = useState<FeryalChatSummary[]>([])
  const [notebooks, setNotebooks] = useState<FeryalNotebook[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Notebook inline create & rename states
  const [addingNotebook, setAddingNotebook] = useState(false)
  const [newNotebookName, setNewNotebookName] = useState('')
  const [editingNbId, setEditingNbId] = useState<string | null>(null)
  const [editingNbText, setEditingNbText] = useState('')

  // Chat inline rename & move states
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editingChatTitle, setEditingChatTitle] = useState('')
  const [movingChatId, setMovingChatId] = useState<string | null>(null)
  const [backupToast, setBackupToast] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const refresh = () => {
      setChats(getChatIndexSync())
      setNotebooks(getNotebooksSync())
    }
    void hydrateFeryalChatStore().then(({ chats: c, notebooks: nb }) => {
      setChats(c)
      setNotebooks(nb)
    })
    window.addEventListener(FERYAL_CHATS_UPDATED_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(FERYAL_CHATS_UPDATED_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  const groupedChats = useMemo(
    () =>
      filterAndGroupChats({
        chats,
        notebooks,
        activeNotebookId,
        searchQuery,
      }),
    [activeNotebookId, chats, notebooks, searchQuery],
  )

  const notebookMap = useMemo(() => new Map(notebooks.map((n) => [n.id, n])), [notebooks])

  const notebookCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of chats) {
      counts.set(c.notebookId, (counts.get(c.notebookId) ?? 0) + 1)
    }
    return counts
  }, [chats])

  const handleCreateNotebook = () => {
    const created = createNotebook(newNotebookName)
    if (created) {
      setNewNotebookName('')
      setAddingNotebook(false)
      onSelectNotebook(created.id)
    }
  }

  const handleExportJson = async () => {
    try {
      const json = await exportFeryalWorkspaceJson()
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `feryal-notebooks-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setBackupToast(isAr ? 'تم تنزيل نسخة JSON ✓' : 'JSON Backup Saved ✓')
      window.setTimeout(() => setBackupToast(null), 2400)
    } catch {}
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const res = await importFeryalWorkspaceJson(text)
      setBackupToast(
        isAr
          ? `تمت استعادة ${res.restoredChats} محادثة ✓`
          : `Restored ${res.restoredChats} chats ✓`,
      )
      window.setTimeout(() => setBackupToast(null), 2800)
    } catch {
      setBackupToast(isAr ? 'ملف JSON غير صالح' : 'Invalid JSON file')
      window.setTimeout(() => setBackupToast(null), 2800)
    }
  }

  return (
    <aside className={`lg:col-span-4 ${panelClassName} flex flex-col overflow-hidden p-4 sm:p-5`}>
      {/* Top Verdelo Segmented Toggle */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <SlidingPillTabs
          ariaLabel={isAr ? 'تبديل لوحة فريال الجانبية' : 'Switch Feryal Side Panel'}
          surface="muted"
          size="sm"
          className="w-full justify-between"
          value={tab}
          onChange={setTab}
          options={[
            {
              id: 'chats',
              label: isAr ? 'محادثاتي ودفاتري 💬' : 'Chats & Notebooks 💬',
              badge: chats.length > 0 ? chats.length : undefined,
            },
            {
              id: 'notes',
              label: isAr ? 'أهم ملاحظات اليوم ⚡' : "Today's Notes ⚡",
            },
          ]}
        />
      </div>

      {tab === 'chats' ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {/* + محادثة جديدة & Search Bar */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={onNewChat}
              className="ae-btn-primary flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-[13px] font-extrabold transition-all duration-150 hover:opacity-95 active:scale-[0.99]"
            >
              <Plus className="h-4 w-4" />
              <span>{isAr ? '+ محادثة جديدة' : '+ New Conversation'}</span>
            </button>

            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 start-3.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isAr
                    ? '🔍 ابحث في جميع المحادثات والدفاتر…'
                    : '🔍 Search all chats & notebooks…'
                }
                className="ae-bento-subcard h-9 w-full rounded-full ps-9 pe-3 text-[12.5px] font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 dark:text-white"
              />
            </div>
          </div>

          {/* دفاتر المواضيع 📁 */}
          <div className="space-y-1.5 border-b border-slate-100 pb-2.5 dark:border-white/[0.06]">
            <div className="flex items-center justify-between gap-2 px-0.5">
              <span className="text-[11.5px] font-extrabold text-slate-600 dark:text-slate-300">
                {isAr ? 'دفاتر المواضيع 📁' : 'Topic Notebooks 📁'}
              </span>
              <button
                type="button"
                onClick={() => setAddingNotebook((v) => !v)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
              >
                <FolderPlus className="h-3 w-3" />
                <span>{isAr ? '+ دفتر جديد' : '+ New Notebook'}</span>
              </button>
            </div>

            {addingNotebook ? (
              <div className="flex items-center gap-1.5 pt-1">
                <input
                  type="text"
                  value={newNotebookName}
                  onChange={(e) => setNewNotebookName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateNotebook()
                    if (e.key === 'Escape') setAddingNotebook(false)
                  }}
                  placeholder={isAr ? 'اسم الدفتر الجديد…' : 'Notebook name…'}
                  className="ae-bento-subcard h-8 flex-1 rounded-full px-3 text-[12px] text-slate-900 focus:outline-none dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleCreateNotebook}
                  className="ae-btn-primary inline-flex h-8 items-center rounded-full px-3 text-[11.5px] font-bold"
                >
                  {isAr ? 'إضافة' : 'Add'}
                </button>
              </div>
            ) : null}

            <div className="flex max-h-[112px] flex-wrap gap-1.5 overflow-y-auto pt-0.5">
              <button
                type="button"
                onClick={() => onSelectNotebook('all')}
                className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold transition-all ${
                  activeNotebookId === 'all'
                    ? 'bg-[#0B1220] text-white dark:bg-[#10B981] dark:text-[#04130D]'
                    : 'ae-bento-subcard text-slate-700 hover:opacity-90 dark:text-slate-200'
                }`}
              >
                <span>{isAr ? 'كل الدفاتر' : 'All'}</span>
                <span className="opacity-75 tabular-nums">({chats.length})</span>
              </button>

              {notebooks.map((nb) => {
                const isSelected = activeNotebookId === nb.id
                const count = notebookCounts.get(nb.id) ?? 0
                if (editingNbId === nb.id) {
                  return (
                    <div
                      key={nb.id}
                      className="ae-bento-subcard inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                    >
                      <input
                        type="text"
                        value={editingNbText}
                        onChange={(e) => setEditingNbText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            renameNotebook(nb.id, editingNbText)
                            setEditingNbId(null)
                          }
                          if (e.key === 'Escape') setEditingNbId(null)
                        }}
                        className="w-28 bg-transparent text-[11.5px] font-bold text-slate-900 focus:outline-none dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          renameNotebook(nb.id, editingNbText)
                          setEditingNbId(null)
                        }}
                        className="text-emerald-600"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingNbId(null)}
                        className="text-slate-400"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )
                }

                return (
                  <div key={nb.id} className="group inline-flex items-center">
                    <button
                      type="button"
                      onClick={() => onSelectNotebook(isSelected ? 'all' : nb.id)}
                      className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold transition-all ${
                        isSelected
                          ? 'bg-[#0B1220] text-white dark:bg-[#10B981] dark:text-[#04130D]'
                          : 'ae-bento-subcard text-slate-700 hover:opacity-90 dark:text-slate-200'
                      }`}
                    >
                      <span>{nb.icon}</span>
                      <span className="max-w-[140px] truncate">
                        {isAr ? nb.nameAr : nb.nameEn}
                      </span>
                      {count > 0 ? (
                        <span className="opacity-75 tabular-nums">({count})</span>
                      ) : null}
                    </button>
                    {isSelected ? (
                      <div className="ms-0.5 inline-flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNbId(nb.id)
                            setEditingNbText(isAr ? nb.nameAr : nb.nameEn)
                          }}
                          title={isAr ? 'تعديل اسم الدفتر' : 'Rename notebook'}
                          className="rounded-full p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        {!nb.isDefault ? (
                          <button
                            type="button"
                            onClick={() => {
                              deleteNotebook(nb.id)
                              onSelectNotebook('all')
                            }}
                            title={isAr ? 'حذف الدفتر' : 'Delete notebook'}
                            className="rounded-full p-1 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Chronological Saved Conversations List */}
          <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto pe-1">
            {groupedChats.length === 0 ? (
              <div className="ae-bento-subcard rounded-2xl p-5 text-center">
                <p className="text-[13px] font-bold text-slate-700 dark:text-slate-200">
                  {searchQuery
                    ? isAr
                      ? 'لا توجد محادثات مطابقة لبحثك'
                      : 'No conversations match your search'
                    : isAr
                      ? 'تُحفظ محادثاتك تلقائياً فور إرسال أول سؤال'
                      : 'Chats auto-save automatically once you send a message'}
                </p>
                <p className="mt-1 text-[11.5px] text-slate-500 dark:text-slate-400">
                  {isAr
                    ? 'عناوين عربية ذكية من ٤–٦ كلمات مصنّفة داخل دفاتر المواضيع.'
                    : 'Auto-titled in 4–6 words and organized into Topic Notebooks.'}
                </p>
              </div>
            ) : (
              groupedChats.map((group) => (
                <div key={group.id} className="space-y-1.5">
                  <div className="px-1 text-[11px] font-extrabold tracking-wide text-slate-400 uppercase dark:text-slate-500">
                    {isAr ? group.labelAr : group.labelEn}
                  </div>

                  {group.chats.map((chat) => {
                    const isCurrent = chat.id === activeChatId
                    const nb = notebookMap.get(chat.notebookId)

                    return (
                      <div
                        key={chat.id}
                        className={`group rounded-2xl p-3 transition-all ${
                          isCurrent
                            ? 'bg-emerald-50/90 ring-1 ring-emerald-500/40 dark:bg-emerald-950/40 dark:ring-emerald-500/40'
                            : 'ae-bento-subcard hover:ring-1 hover:ring-slate-300 dark:hover:ring-white/15'
                        }`}
                      >
                        {editingChatId === chat.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={editingChatTitle}
                              onChange={(e) => setEditingChatTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  void renameChat(chat.id, editingChatTitle)
                                  setEditingChatId(null)
                                }
                                if (e.key === 'Escape') setEditingChatId(null)
                              }}
                              className="h-8 flex-1 rounded-xl bg-white px-2.5 text-[12.5px] font-bold text-slate-900 ring-1 ring-slate-300 focus:outline-none dark:bg-[#0B1220] dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                void renameChat(chat.id, editingChatTitle)
                                setEditingChatId(null)
                              }}
                              className="rounded-full p-1 text-emerald-600"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingChatId(null)}
                              className="rounded-full p-1 text-slate-400"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => onSelectChat(chat.id)}
                                className="min-w-0 flex-1 cursor-pointer text-start"
                              >
                                <div className="truncate text-[13px] font-extrabold text-slate-950 dark:text-white">
                                  {chat.pinned ? '📌 ' : ''}
                                  {chat.title}
                                </div>
                                {chat.previewText ? (
                                  <p className="mt-0.5 line-clamp-1 text-[11.5px] text-slate-500 dark:text-slate-400">
                                    {chat.previewText}
                                  </p>
                                ) : null}
                              </button>

                              {/* Pin / Rename / Move / Delete Controls */}
                              <div className="flex shrink-0 items-center gap-0.5 opacity-80 transition-opacity group-hover:opacity-100">
                                <button
                                  type="button"
                                  onClick={() => void togglePinChat(chat.id)}
                                  title={isAr ? 'تثبيت المحادثة' : 'Pin chat'}
                                  className={`rounded-full p-1 ${
                                    chat.pinned
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-slate-400 hover:text-slate-800 dark:hover:text-white'
                                  }`}
                                >
                                  <Pin className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingChatId(chat.id)
                                    setEditingChatTitle(chat.title)
                                  }}
                                  title={isAr ? 'تعديل العنوان' : 'Rename'}
                                  className="rounded-full p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setMovingChatId((prev) => (prev === chat.id ? null : chat.id))
                                  }
                                  title={isAr ? 'نقل لدفتر آخر' : 'Move to notebook'}
                                  className="rounded-full p-1 text-slate-400 hover:text-slate-800 dark:hover:text-white"
                                >
                                  <FolderInput className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void deleteChat(chat.id)}
                                  title={isAr ? 'حذف' : 'Delete'}
                                  className="rounded-full p-1 text-slate-400 hover:text-rose-600"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-1 text-[10.5px] font-semibold text-slate-400">
                              {nb ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                                  <span>{nb.icon}</span>
                                  <span>{isAr ? nb.nameAr : nb.nameEn}</span>
                                </span>
                              ) : (
                                <span />
                              )}
                              <span className="tabular-nums">
                                {chat.messageCount} {isAr ? 'رسائل' : 'msgs'}
                              </span>
                            </div>

                            {movingChatId === chat.id ? (
                              <div className="flex flex-wrap gap-1 pt-1.5 border-t border-slate-200/60 dark:border-white/[0.06]">
                                {notebooks.map((dest) => (
                                  <button
                                    key={dest.id}
                                    type="button"
                                    onClick={() => {
                                      void moveChatToNotebook(chat.id, dest.id)
                                      setMovingChatId(null)
                                    }}
                                    className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                                      chat.notebookId === dest.id
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-white text-slate-700 ring-1 ring-slate-200 dark:bg-white/10 dark:text-slate-200'
                                    }`}
                                  >
                                    {dest.icon} {isAr ? dest.nameAr : dest.nameEn}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))
            )}
          </div>

          {/* 1-Click JSON Backup & Restore Footer */}
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-[11.5px] dark:border-white/[0.06]">
            {backupToast ? (
              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                {backupToast}
              </span>
            ) : (
              <span className="truncate font-medium text-slate-400">
                {isAr ? 'حفظ تلقائي دائم (IndexedDB)' : 'Real-time IndexedDB Auto-Save'}
              </span>
            )}
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => void handleExportJson()}
                className="ae-bento-subcard inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 font-bold text-slate-700 hover:opacity-90 dark:text-slate-200"
                title={isAr ? 'تنزيل نسخة احتياطية JSON للمحادثات والذاكرة' : 'Export JSON backup'}
              >
                <Download className="h-3 w-3" />
                <span>{isAr ? 'نسخ JSON' : 'Backup'}</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="ae-bento-subcard inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 font-bold text-slate-700 hover:opacity-90 dark:text-slate-200"
                title={isAr ? 'استعادة محادثات ودفاتر من ملف JSON' : 'Restore JSON backup'}
              >
                <Upload className="h-3 w-3" />
                <span>{isAr ? 'استعادة' : 'Restore'}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={(e) => void handleImportFile(e)}
                className="hidden"
              />
            </div>
          </div>
        </div>
      ) : (
        /* أهم ملاحظات اليوم ⚡ */
        <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto pe-1">
          <div>
            <h2 className="text-[15.5px] font-extrabold text-slate-950 dark:text-white">
              {isAr ? 'أهم ملاحظات اليوم ⚡' : "Today's Top Notes ⚡"}
            </h2>
            <p className="mt-0.5 text-[12px] font-medium text-slate-500 dark:text-slate-400">
              {isAr ? workspace.subtitleAr : workspace.subtitleEn}
            </p>
          </div>
          {workspace.feryalNotes.map((note) => (
            <article key={note.id} className="ae-bento-subcard space-y-2.5 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[14px] font-extrabold text-slate-950 dark:text-white">
                  {isAr ? note.titleAr : note.titleEn}
                </h3>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-extrabold tabular-nums text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {isAr ? note.benefitAr : note.benefitEn}
                </span>
              </div>
              <p className="text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-300">
                {isAr ? note.summaryAr : note.summaryEn}
              </p>
              <button
                type="button"
                disabled={isCopilotThinking}
                onClick={() => onRunNotePrompt(isAr ? note.promptAr : note.promptEn)}
                className="ae-btn-primary w-full cursor-pointer rounded-full px-4 py-2 text-[12px] font-bold transition-all duration-150 hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
              >
                {isAr ? 'اسأل فريال' : 'Ask Feryal'}
              </button>
            </article>
          ))}
        </div>
      )}
    </aside>
  )
}
