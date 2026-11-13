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
  isAuditor?: boolean
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
  isAuditor = false,
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
    <aside
      className={`lg:col-span-4 xl:col-span-3 ${panelClassName} flex flex-col overflow-hidden p-4 sm:p-5`}
    >
      {/* Calm Unslop Soft Segmented Switch (Zero solid black pills) */}
      <div
        role="tablist"
        aria-label={isAr ? 'تبديل لوحة فريال الجانبية' : 'Switch Feryal Side Panel'}
        className="mb-3 grid w-full grid-cols-2 gap-1 rounded-full bg-[#F7F7F8] p-1 dark:bg-[#0D1614]"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'chats'}
          onClick={() => setTab('chats')}
          className={`inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all ${
            tab === 'chats'
              ? 'bg-white text-emerald-800 shadow-[0_1px_2px_rgba(0,0,0,0.05)] ring-1 ring-emerald-500/20 dark:bg-emerald-950/70 dark:text-emerald-200 dark:ring-emerald-500/30'
              : 'text-neutral-600 hover:text-neutral-900 dark:text-slate-300 dark:hover:text-white'
          }`}
        >
          <span className="truncate">
            {isAr ? 'محادثاتي ودفاتري 💬' : 'Chats & Notebooks 💬'}
          </span>
          {chats.length > 0 ? (
            <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
              {chats.length}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={tab === 'notes'}
          onClick={() => setTab('notes')}
          className={`inline-flex h-8 cursor-pointer items-center justify-center gap-1 rounded-full px-3 text-xs font-semibold transition-all ${
            tab === 'notes'
              ? 'bg-white text-emerald-800 shadow-[0_1px_2px_rgba(0,0,0,0.05)] ring-1 ring-emerald-500/20 dark:bg-emerald-950/70 dark:text-emerald-200 dark:ring-emerald-500/30'
              : 'text-neutral-600 hover:text-neutral-900 dark:text-slate-300 dark:hover:text-white'
          }`}
        >
          <span className="truncate">
            {isAr ? 'أهم ملاحظات اليوم ⚡' : "Today's Notes ⚡"}
          </span>
        </button>
      </div>

      {tab === 'chats' ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {/* + محادثة جديدة & Search Bar */}
          <div className="space-y-2">
            {!isAuditor ? (
              <button
                type="button"
                onClick={onNewChat}
                className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-emerald-50 px-4 text-[13px] font-semibold text-emerald-800 ring-1 ring-emerald-600/20 transition-all duration-150 hover:bg-emerald-100 active:scale-[0.99] dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-500/35 dark:hover:bg-emerald-950/80"
              >
                <Plus className="h-4 w-4" />
                <span>{isAr ? '+ محادثة جديدة' : '+ New Conversation'}</span>
              </button>
            ) : null}

            <div className="relative">
              <Search className="pointer-events-none absolute start-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isAr
                    ? 'ابحث في المحادثات والدفاتر…'
                    : 'Search chats & notebooks…'
                }
                className="h-9 w-full rounded-full bg-[#F7F7F8] pe-3 ps-9 text-[12.5px] font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 dark:bg-[#0D1614] dark:text-white"
              />
            </div>
          </div>

          {/* دفاتر المواضيع 📁 */}
          <div className="space-y-1.5 border-b border-neutral-100 pb-2.5 dark:border-white/[0.06]">
            <div className="flex items-center justify-between gap-2 px-0.5">
              <span className="text-xs font-semibold text-neutral-600 dark:text-slate-300">
                {isAr ? 'دفاتر المواضيع 📁' : 'Topic Notebooks 📁'}
              </span>
              {!isAuditor ? (
                <button
                  type="button"
                  onClick={() => setAddingNotebook((v) => !v)}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                >
                  <FolderPlus className="h-3 w-3" />
                  <span>{isAr ? '+ دفتر جديد' : '+ New Notebook'}</span>
                </button>
              ) : null}
            </div>

            {!isAuditor && addingNotebook ? (
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
                  className="h-8 flex-1 rounded-full bg-[#F7F7F8] px-3 text-xs text-neutral-900 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 dark:bg-[#0D1614] dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleCreateNotebook}
                  className="btn-colored inline-flex h-8 cursor-pointer items-center rounded-full bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500 dark:bg-emerald-500 dark:text-emerald-950"
                >
                  {isAr ? 'إضافة' : 'Add'}
                </button>
              </div>
            ) : null}

            <div className="flex max-h-[112px] flex-wrap gap-1.5 overflow-y-auto pt-0.5">
              <button
                type="button"
                onClick={() => onSelectNotebook('all')}
                className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-all ${
                  activeNotebookId === 'all'
                    ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/25 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-500/35'
                    : 'bg-[#F7F7F8] text-neutral-700 hover:bg-emerald-50/70 dark:bg-[#0D1614] dark:text-slate-200'
                }`}
              >
                <span>{isAr ? 'كل الدفاتر' : 'All'}</span>
                <span className="tabular-nums opacity-75">({chats.length})</span>
              </button>

              {notebooks.map((nb) => {
                const isSelected = activeNotebookId === nb.id
                const count = notebookCounts.get(nb.id) ?? 0
                if (editingNbId === nb.id) {
                  return (
                    <div
                      key={nb.id}
                      className="inline-flex items-center gap-1 rounded-full bg-[#F7F7F8] px-2 py-0.5 dark:bg-[#0D1614]"
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
                        className="w-28 bg-transparent text-[11.5px] font-semibold text-neutral-900 focus:outline-none dark:text-white"
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
                        className="text-neutral-400"
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
                      className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-all ${
                        isSelected
                          ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/25 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-500/35'
                          : 'bg-[#F7F7F8] text-neutral-700 hover:bg-emerald-50/70 dark:bg-[#0D1614] dark:text-slate-200'
                      }`}
                    >
                      <span>{nb.icon}</span>
                      <span className="max-w-[140px] truncate">
                        {isAr ? nb.nameAr : nb.nameEn}
                      </span>
                      {count > 0 ? (
                        <span className="tabular-nums opacity-75">({count})</span>
                      ) : null}
                    </button>
                    {!isAuditor && isSelected ? (
                      <div className="ms-0.5 inline-flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNbId(nb.id)
                            setEditingNbText(isAr ? nb.nameAr : nb.nameEn)
                          }}
                          title={isAr ? 'تعديل اسم الدفتر' : 'Rename notebook'}
                          className="rounded-full p-1 text-neutral-400 hover:text-neutral-800 dark:hover:text-white"
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
                            className="rounded-full p-1 text-neutral-400 hover:text-rose-600"
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
              <div className="rounded-2xl bg-[#F7F7F8] p-5 text-center dark:bg-[#0D1614]">
                <p className="text-[13.5px] font-semibold text-neutral-800 dark:text-slate-200">
                  {searchQuery
                    ? isAr
                      ? 'لا توجد محادثات مطابقة لبحثك'
                      : 'No conversations match your search'
                    : isAr
                      ? 'تُحفظ محادثاتك تلقائياً فور إرسال أول سؤال'
                      : 'Chats auto-save automatically once you send a message'}
                </p>
                <p className="mt-1 text-xs text-neutral-500 dark:text-slate-400">
                  {isAr
                    ? 'عناوين عربية ذكية من ٤–٦ كلمات مصنّفة داخل دفاتر المواضيع.'
                    : 'Auto-titled in 4–6 words and organized into Topic Notebooks.'}
                </p>
              </div>
            ) : (
              groupedChats.map((group) => (
                <div key={group.id} className="space-y-1.5">
                  <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400 dark:text-slate-500">
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
                            ? 'bg-emerald-50/90 ring-1 ring-emerald-500/35 dark:bg-emerald-950/45 dark:ring-emerald-500/35'
                            : 'bg-[#F7F7F8] hover:ring-1 hover:ring-neutral-300/80 dark:bg-[#0D1614] dark:hover:ring-white/15'
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
                              className="h-8 flex-1 rounded-xl bg-white px-2.5 text-[12.5px] font-semibold text-neutral-900 ring-1 ring-neutral-300 focus:outline-none dark:bg-[#111A22] dark:text-white"
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
                              className="rounded-full p-1 text-neutral-400"
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
                                <div className="truncate text-[13.5px] font-semibold text-neutral-950 dark:text-white">
                                  {chat.pinned ? '📌 ' : ''}
                                  {chat.title}
                                </div>
                                {chat.previewText ? (
                                  <p className="mt-0.5 line-clamp-1 text-xs text-neutral-500 dark:text-slate-400">
                                    {chat.previewText}
                                  </p>
                                ) : null}
                              </button>

                              {/* Pin / Rename / Move / Delete Controls */}
                              {!isAuditor ? (
                                <div className="flex shrink-0 items-center gap-0.5 opacity-80 transition-opacity group-hover:opacity-100">
                                  <button
                                    type="button"
                                    onClick={() => void togglePinChat(chat.id)}
                                    title={isAr ? 'تثبيت المحادثة' : 'Pin chat'}
                                    className={`rounded-full p-1 ${
                                      chat.pinned
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-neutral-400 hover:text-neutral-800 dark:hover:text-white'
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
                                    className="rounded-full p-1 text-neutral-400 hover:text-neutral-800 dark:hover:text-white"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setMovingChatId((prev) => (prev === chat.id ? null : chat.id))
                                    }
                                    title={isAr ? 'نقل لدفتر آخر' : 'Move to notebook'}
                                    className="rounded-full p-1 text-neutral-400 hover:text-neutral-800 dark:hover:text-white"
                                  >
                                    <FolderInput className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void deleteChat(chat.id)}
                                    title={isAr ? 'حذف' : 'Delete'}
                                    className="rounded-full p-1 text-neutral-400 hover:text-rose-600"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : null}
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-medium text-neutral-400">
                              {nb ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-neutral-600 dark:bg-[#111A22] dark:text-slate-300">
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
                              <div className="flex flex-wrap gap-1 border-t border-neutral-200/60 pt-1.5 dark:border-white/[0.06]">
                                {notebooks.map((dest) => (
                                  <button
                                    key={dest.id}
                                    type="button"
                                    onClick={() => {
                                      void moveChatToNotebook(chat.id, dest.id)
                                      setMovingChatId(null)
                                    }}
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                      chat.notebookId === dest.id
                                        ? 'btn-colored bg-emerald-600 text-white'
                                        : 'bg-white text-neutral-700 ring-1 ring-neutral-200 dark:bg-[#111A22] dark:text-slate-200 dark:ring-white/10'
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
          <div className="flex items-center justify-between gap-2 border-t border-neutral-100 pt-2.5 text-[11.5px] dark:border-white/[0.06]">
            {backupToast ? (
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {backupToast}
              </span>
            ) : (
              <span className="truncate font-medium text-neutral-400">
                {isAr ? 'حفظ تلقائي دائم (IndexedDB)' : 'Real-time IndexedDB Auto-Save'}
              </span>
            )}
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => void handleExportJson()}
                className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-[#F7F7F8] px-2.5 py-1 font-semibold text-neutral-700 hover:bg-emerald-50 hover:text-emerald-800 dark:bg-[#0D1614] dark:text-slate-200"
                title={isAr ? 'تنزيل نسخة احتياطية JSON للمحادثات والذاكرة' : 'Export JSON backup'}
              >
                <Download className="h-3 w-3" />
                <span>{isAr ? 'نسخ JSON' : 'Backup'}</span>
              </button>
              {!isAuditor ? (
                <>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-[#F7F7F8] px-2.5 py-1 font-semibold text-neutral-700 hover:bg-emerald-50 hover:text-emerald-800 dark:bg-[#0D1614] dark:text-slate-200"
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
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        /* أهم ملاحظات اليوم ⚡ */
        <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto pe-1">
          <div>
            <h2 className="text-[15px] font-semibold text-neutral-950 dark:text-white">
              {isAr ? 'أهم ملاحظات اليوم ⚡' : "Today's Top Notes ⚡"}
            </h2>
            <p className="mt-0.5 text-xs font-medium text-neutral-500 dark:text-slate-400">
              {isAr ? workspace.subtitleAr : workspace.subtitleEn}
            </p>
          </div>
          {workspace.feryalNotes.map((note) => (
            <article
              key={note.id}
              className="space-y-2.5 rounded-2xl bg-[#F7F7F8] p-4 dark:bg-[#0D1614]"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[14px] font-semibold text-neutral-950 dark:text-white">
                  {isAr ? note.titleAr : note.titleEn}
                </h3>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {isAr ? note.benefitAr : note.benefitEn}
                </span>
              </div>
              <p className="text-[13px] leading-relaxed text-neutral-600 dark:text-slate-300">
                {isAr ? note.summaryAr : note.summaryEn}
              </p>
              {!isAuditor ? (
                <button
                  type="button"
                  disabled={isCopilotThinking}
                  onClick={() => onRunNotePrompt(isAr ? note.promptAr : note.promptEn)}
                  className="w-full cursor-pointer rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-600/20 transition-all duration-150 hover:bg-emerald-100 active:scale-[0.98] disabled:opacity-50 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-500/30"
                >
                  {isAr ? 'اسأل فريال' : 'Ask Feryal'}
                </button>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </aside>
  )
}
