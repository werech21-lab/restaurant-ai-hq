'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { formatDate } from '@/lib/format'
import {
  Check,
  Cloud,
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
  activeTab?: 'chats' | 'notes'
  onTabChange?: (tab: 'chats' | 'notes') => void
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
  activeTab,
  onTabChange,
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
  const [internalTab, setInternalTab] = useState<'chats' | 'notes'>('chats')
  const tab = activeTab ?? internalTab
  const handleSwitchTab = (next: 'chats' | 'notes') => {
    setInternalTab(next)
    onTabChange?.(next)
  }
  const [chats, setChats] = useState<FeryalChatSummary[]>([])
  const [notebooks, setNotebooks] = useState<FeryalNotebook[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  const [addingNotebook, setAddingNotebook] = useState(false)
  const [newNotebookName, setNewNotebookName] = useState('')
  const [editingNbId, setEditingNbId] = useState<string | null>(null)
  const [editingNbText, setEditingNbText] = useState('')

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
    refresh()
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
    if (isAuditor) return
    const created = createNotebook(newNotebookName)
    if (created) {
      setNewNotebookName('')
      setAddingNotebook(false)
      onSelectNotebook(created.id)
    }
  }

  const handleDeleteChatRow = async (chatId: string) => {
    if (isAuditor) return
    const wasCurrent = chatId === activeChatId
    await deleteChat(chatId)
    if (wasCurrent) {
      onNewChat()
    }
  }

  const handleExportJson = async () => {
    if (isAuditor) return
    try {
      const json = await exportFeryalWorkspaceJson()
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `feryal-notebooks-backup-${formatDate(new Date(), 'en')}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setBackupToast(isAr ? 'تم التنزيل ✓' : 'Saved ✓')
      window.setTimeout(() => setBackupToast(null), 2400)
    } catch {
      // ignore export error
    }
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
      setBackupToast(isAr ? 'ملف غير صالح' : 'Invalid JSON')
      window.setTimeout(() => setBackupToast(null), 2800)
    }
  }

  return (
    <div
      data-feryal-history-rail="true"
      className={`${panelClassName} flex h-full min-h-0 flex-col overflow-hidden p-3 sm:p-3.5`}
    >
      {/* Segmented Switch */}
      <div
        role="tablist"
        aria-label={isAr ? 'تبديل لوحة فريال الجانبية' : 'Switch Feryal Side Panel'}
        className="mb-2.5 grid w-full grid-cols-2 gap-1 rounded-xl bg-[#F6F7F8] p-1 dark:bg-[#0D1614]"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'chats'}
          onClick={() => handleSwitchTab('chats')}
          className={`inline-flex min-h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
            tab === 'chats'
              ? 'bg-white text-emerald-800 shadow-2xs ring-1 ring-emerald-500/20 dark:bg-emerald-950/70 dark:text-emerald-200 dark:ring-emerald-500/30'
              : 'text-neutral-600 hover:text-neutral-900 dark:text-slate-300 dark:hover:text-white'
          }`}
        >
          <span className="truncate">{isAr ? 'سجل المحادثات' : 'Chat History'}</span>
          {chats.length > 0 ? (
            <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-xs font-bold tabular-nums text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
              {chats.length}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={tab === 'notes'}
          onClick={() => handleSwitchTab('notes')}
          className={`inline-flex min-h-8 cursor-pointer items-center justify-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
            tab === 'notes'
              ? 'bg-white text-emerald-800 shadow-2xs ring-1 ring-emerald-500/20 dark:bg-emerald-950/70 dark:text-emerald-200 dark:ring-emerald-500/30'
              : 'text-neutral-600 hover:text-neutral-900 dark:text-slate-300 dark:hover:text-white'
          }`}
        >
          <span className="truncate">{isAr ? 'ملاحظات اليوم ⚡' : "Today's Notes ⚡"}</span>
        </button>
      </div>

      {tab === 'chats' ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2.5">
          {/* New Chat & Search */}
          <div className="space-y-2">
            {!isAuditor ? (
              <button
                type="button"
                data-feryal-new-chat="true"
                onClick={onNewChat}
                className="flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-xs font-bold text-white shadow-2xs transition-all duration-150 hover:bg-emerald-700 active:scale-[0.99]"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span>{isAr ? 'محادثة جديدة' : 'New Conversation'}</span>
              </button>
            ) : null}

            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAr ? 'بحث في المحادثات…' : 'Search history…'}
                className="h-8 w-full rounded-xl bg-[#F6F7F8] pe-3 ps-8 text-xs font-medium text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 dark:bg-[#0D1614] dark:text-white"
              />
            </div>
          </div>

          {/* Compact Topic Notebooks Filter Strip */}
          <div className="space-y-1.5 border-b border-neutral-100 pb-2 dark:border-white/[0.06]">
            <div className="flex items-center justify-between gap-2 px-0.5">
              <span className="min-w-0 truncate text-xs font-semibold text-neutral-500 dark:text-slate-400">
                {isAr ? 'الدفاتر' : 'Notebooks'}
              </span>
              {!isAuditor ? (
                <button
                  type="button"
                  onClick={() => setAddingNotebook((v) => !v)}
                  className="inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg px-1.5 py-0.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                >
                  <FolderPlus className="h-3 w-3 shrink-0" />
                  <span>{isAr ? 'جديد' : 'New'}</span>
                </button>
              ) : null}
            </div>

            {!isAuditor && addingNotebook ? (
              <div className="flex items-center gap-1.5 pt-0.5">
                <input
                  type="text"
                  value={newNotebookName}
                  onChange={(e) => setNewNotebookName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateNotebook()
                    if (e.key === 'Escape') setAddingNotebook(false)
                  }}
                  placeholder={isAr ? 'اسم الدفتر…' : 'Notebook name…'}
                  className="h-8 flex-1 rounded-lg bg-[#F6F7F8] px-2.5 text-xs text-neutral-900 focus:outline-none focus:ring-1 focus:ring-emerald-500/40 dark:bg-[#0D1614] dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleCreateNotebook}
                  className="btn-colored inline-flex h-8 cursor-pointer items-center rounded-lg bg-emerald-600 px-2.5 text-xs font-semibold text-white hover:bg-emerald-500"
                >
                  {isAr ? 'حفظ' : 'Add'}
                </button>
              </div>
            ) : null}

            <div className="flex max-h-[76px] flex-wrap gap-1 overflow-y-auto pt-0.5">
              <button
                type="button"
                onClick={() => onSelectNotebook('all')}
                className={`inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition-all ${
                  activeNotebookId === 'all'
                    ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/25 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-500/35'
                    : 'bg-[#F6F7F8] text-neutral-700 hover:bg-emerald-50/70 dark:bg-[#0D1614] dark:text-slate-200'
                }`}
              >
                <span>{isAr ? 'الكل' : 'All'}</span>
                <span className="tabular-nums opacity-75">({chats.length})</span>
              </button>

              {notebooks.map((nb) => {
                const isSelected = activeNotebookId === nb.id
                const count = notebookCounts.get(nb.id) ?? 0
                if (editingNbId === nb.id) {
                  return (
                    <div
                      key={nb.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#F6F7F8] px-2 py-0.5 dark:bg-[#0D1614]"
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
                        className="w-24 bg-transparent text-xs font-semibold text-neutral-900 focus:outline-none dark:text-white"
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
                      className={`inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600/25 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-500/35'
                          : 'bg-[#F6F7F8] text-neutral-700 hover:bg-emerald-50/70 dark:bg-[#0D1614] dark:text-slate-200'
                      }`}
                    >
                      <span>{nb.icon}</span>
                      <span className="max-w-[116px] truncate">
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
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pe-0.5">
            {groupedChats.length === 0 ? (
              <div className="rounded-xl bg-[#F6F7F8] px-3 py-4 text-center dark:bg-[#0D1614]">
                <p className="text-xs font-medium leading-relaxed text-neutral-500 dark:text-slate-400">
                  {searchQuery
                    ? isAr
                      ? 'لا توجد نتائج مطابقة'
                      : 'No matching conversations'
                    : isAuditor
                      ? isAr
                        ? 'لا توجد محادثات محفوظة لهذا الحساب'
                        : 'No saved threads for this session'
                      : isAr
                        ? 'ستظهر محادثاتك المحفوظة هنا تلقائياً'
                        : 'Your saved conversations appear here automatically'}
                </p>
              </div>
            ) : (
              groupedChats.map((group) => (
                <div key={group.id} className="space-y-1">
                  <div className="px-1 text-xs font-semibold text-neutral-400 dark:text-slate-500">
                    {isAr ? group.labelAr : group.labelEn}
                  </div>

                  {group.chats.map((chat) => {
                    const isCurrent = chat.id === activeChatId
                    const nb = notebookMap.get(chat.notebookId)

                    return (
                      <div
                        key={chat.id}
                        data-feryal-thread-item={chat.id}
                        className={`group rounded-xl p-2.5 transition-all ${
                          isCurrent
                            ? 'bg-emerald-50/90 ring-1 ring-emerald-500/35 dark:bg-emerald-950/45 dark:ring-emerald-500/35'
                            : 'bg-[#F6F7F8] hover:ring-1 hover:ring-neutral-300/80 dark:bg-[#0D1614] dark:hover:ring-white/15'
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
                              className="h-7 flex-1 rounded-lg bg-white px-2 text-xs font-semibold text-neutral-900 ring-1 ring-neutral-300 focus:outline-none dark:bg-[#111A22] dark:text-white"
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
                          <div className="space-y-1">
                            <div className="flex items-start justify-between gap-1.5">
                              <button
                                type="button"
                                onClick={() => onSelectChat(chat.id)}
                                className="min-w-0 flex-1 cursor-pointer text-start"
                              >
                                <div className="truncate text-[13px] font-semibold text-neutral-950 dark:text-white">
                                  {chat.pinned ? '📌 ' : ''}
                                  {chat.title}
                                </div>
                                {chat.previewText ? (
                                  <p className="mt-0.5 line-clamp-1 text-xs text-neutral-500 dark:text-slate-400">
                                    {chat.previewText}
                                  </p>
                                ) : null}
                              </button>

                              {!isAuditor ? (
                                <div className="flex shrink-0 items-center gap-0.5 opacity-75 transition-opacity group-hover:opacity-100">
                                  <button
                                    type="button"
                                    onClick={() => void togglePinChat(chat.id)}
                                    title={isAr ? 'تثبيت' : 'Pin'}
                                    className={`rounded-full p-1 ${
                                      chat.pinned
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-neutral-400 hover:text-neutral-800 dark:hover:text-white'
                                    }`}
                                  >
                                    <Pin className="h-3 w-3" />
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
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setMovingChatId((prev) => (prev === chat.id ? null : chat.id))
                                    }
                                    title={isAr ? 'نقل لدفتر' : 'Move'}
                                    className="rounded-full p-1 text-neutral-400 hover:text-neutral-800 dark:hover:text-white"
                                  >
                                    <FolderInput className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteChatRow(chat.id)}
                                    title={isAr ? 'حذف' : 'Delete'}
                                    className="rounded-full p-1 text-neutral-400 hover:text-rose-600"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : null}
                            </div>

                            <div className="flex items-center justify-between gap-1.5 text-xs font-medium text-neutral-400">
                              {nb ? (
                                <span className="inline-flex min-w-0 max-w-[150px] items-center gap-1 rounded-md bg-white/90 px-1.5 py-0.5 text-neutral-600 dark:bg-[#111A22] dark:text-slate-300">
                                  <span className="shrink-0">{nb.icon}</span>
                                  <span className="truncate">{isAr ? nb.nameAr : nb.nameEn}</span>
                                </span>
                              ) : (
                                <span />
                              )}
                              <span className="shrink-0 whitespace-nowrap tabular-nums">
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
                                    className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${
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

          {/* Compact Cloud Auto-Save & Backup Footer */}
          <div className="flex items-center justify-between gap-2 border-t border-neutral-100 pt-2 text-xs dark:border-white/[0.06]">
            {isAuditor ? (
              <span className="min-w-0 break-words font-medium text-slate-500 dark:text-slate-400">
                {isAr ? 'جلسة قراءة فقط' : 'Read-only session'}
              </span>
            ) : (
              <>
                {backupToast ? (
                  <span className="min-w-0 truncate font-semibold text-emerald-700 dark:text-emerald-400">
                    {backupToast}
                  </span>
                ) : (
                  <span className="inline-flex min-w-0 items-center gap-1 truncate font-medium text-neutral-400">
                    <Cloud className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span className="truncate">{isAr ? 'حفظ سحابي تلقائي' : 'Cloud Auto-Save'}</span>
                  </span>
                )}
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void handleExportJson()}
                    className="inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg bg-[#F6F7F8] px-2 py-1 font-semibold text-neutral-700 hover:bg-emerald-50 hover:text-emerald-800 dark:bg-[#0D1614] dark:text-slate-200"
                    title={isAr ? 'تصدير نسخة احتياطية JSON' : 'Export JSON backup'}
                  >
                    <Download className="h-3 w-3 shrink-0" />
                    <span>{isAr ? 'تصدير' : 'Backup'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg bg-[#F6F7F8] px-2 py-1 font-semibold text-neutral-700 hover:bg-emerald-50 hover:text-emerald-800 dark:bg-[#0D1614] dark:text-slate-200"
                    title={isAr ? 'استعادة من ملف JSON' : 'Restore JSON backup'}
                  >
                    <Upload className="h-3 w-3 shrink-0" />
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
              </>
            )}
          </div>
        </div>
      ) : (
        /* Today's Top Notes */
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pe-0.5">
          <div>
            <h3 className="text-[14px] font-semibold text-neutral-950 dark:text-white">
              {isAr ? 'أهم ملاحظات اليوم ⚡' : "Today's Top Notes ⚡"}
            </h3>
            <p className="mt-0.5 text-xs font-medium text-neutral-500 dark:text-slate-400">
              {isAr ? workspace.subtitleAr : workspace.subtitleEn}
            </p>
          </div>
          {workspace.feryalNotes.map((note) => (
            <article
              key={note.id}
              className="space-y-2 rounded-xl bg-[#F6F7F8] p-3.5 dark:bg-[#0D1614]"
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-neutral-950 dark:text-white">
                  {isAr ? note.titleAr : note.titleEn}
                </h4>
                <span className="shrink-0 whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  {isAr ? note.benefitAr : note.benefitEn}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-neutral-600 dark:text-slate-300">
                {isAr ? note.summaryAr : note.summaryEn}
              </p>
              {!isAuditor ? (
                <button
                  type="button"
                  disabled={isCopilotThinking}
                  onClick={() => onRunNotePrompt(isAr ? note.promptAr : note.promptEn)}
                  className="w-full cursor-pointer rounded-xl bg-emerald-50 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-600/20 transition-all duration-150 hover:bg-emerald-100 active:scale-[0.98] disabled:opacity-50 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-500/30"
                >
                  {isAr ? 'اسأل فريال' : 'Ask Feryal'}
                </button>
              ) : (
                <span className="inline-flex items-center rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  {isAr ? 'ملاحظة من Odoo 17' : 'Odoo 17 Note'}
                </span>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
