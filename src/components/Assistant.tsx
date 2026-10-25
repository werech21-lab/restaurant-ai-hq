'use client'

import { useEffect, useRef, useState } from 'react'
import { answerQuestion, welcomeAnswer, type Answer, type Piece } from '@/lib/assistant'
import { useI18n, type MessageKey } from '@/lib/i18n'
import type { SectionId } from '@/lib/nav'
import { Num } from '@/components/ui'

type Message = {
  id: number
  role: 'user' | 'assistant'
  text?: string
  answer?: Answer
}

function Pieces({ parts }: { parts: Piece[] }) {
  return (
    <>
      {parts.map((part, index) =>
        part.kind === 'num' ? (
          <Num key={index}>{part.value}</Num>
        ) : part.value ? (
          <span key={index}>{part.value}</span>
        ) : null
      )}
    </>
  )
}

function AnswerBody({ answer, onOpen }: { answer: Answer; onOpen: (id: SectionId) => void }) {
  const { t } = useI18n()
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gold-300">{answer.title}</p>
      {answer.paragraphs.map((parts, index) => (
        <p key={index} className="text-sm leading-7 text-mist-100">
          <Pieces parts={parts} />
        </p>
      ))}
      {answer.bullets ? (
        <ul className="space-y-1.5">
          {answer.bullets.map((parts, index) => (
            <li key={index} className="flex gap-2 text-sm leading-6 text-mist-300">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />
              <span>
                <Pieces parts={parts} />
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {answer.section ? (
        <button
          type="button"
          onClick={() => onOpen(answer.section as SectionId)}
          className="mt-1 cursor-pointer rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
        >
          {t('assistant.openSection')} · {t(`nav.${answer.section}` as MessageKey)}
        </button>
      ) : null}
    </div>
  )
}

export default function Assistant({ onOpen }: { onOpen: (id: SectionId) => void }) {
  const { locale, t } = useI18n()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const [messages, setMessages] = useState<Message[]>(() => [
    { id: 1, role: 'assistant', answer: welcomeAnswer(locale) },
  ])
  const scroller = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMessages((current) =>
      current.some((message) => message.role === 'user')
        ? current
        : [{ id: 1, role: 'assistant', answer: welcomeAnswer(locale) }]
    )
  }, [locale])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [messages, thinking, open])

  useEffect(() => {
    if (open) field.current?.focus()
  }, [open])

  const suggestions = [t('assistant.q1'), t('assistant.q2'), t('assistant.q3'), t('assistant.q4'), t('assistant.q5')]

  function ask(value: string) {
    const question = value.trim()
    if (!question || thinking) return
    const userId = Date.now()
    setMessages((current) => [...current, { id: userId, role: 'user', text: question }])
    setDraft('')
    setThinking(true)
    window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        { id: userId + 1, role: 'assistant', answer: answerQuestion(question, locale) },
      ])
      setThinking(false)
    }, 420)
  }

  return (
    <>
      {open ? (
        <section
          className="fixed bottom-[5.25rem] end-3 z-50 flex h-[min(34rem,calc(100dvh-7.5rem))] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-3xl border border-gold-300/20 bg-ink-900 shadow-lift sm:end-5"
          aria-label={t('assistant.title')}
        >
          <header className="flex items-start justify-between gap-3 border-b border-gold-300/10 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-mist-100">{t('assistant.title')}</p>
              <p className="mt-0.5 text-xs text-mist-400">{t('assistant.subtitle')}</p>
            </div>
            <button
              type="button"
              aria-label={t('assistant.close')}
              onClick={() => setOpen(false)}
              className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full text-mist-400 transition hover:bg-white/[0.05] hover:text-mist-100"
            >
              <span aria-hidden className="text-lg leading-none">
                ×
              </span>
            </button>
          </header>

          <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((message) =>
              message.role === 'user' ? (
                <div key={message.id} className="ms-8 rounded-2xl bg-gold-400/15 px-3 py-2 text-sm leading-7 text-mist-100">
                  {message.text}
                </div>
              ) : message.answer ? (
                <div key={message.id} className="me-4 rounded-2xl border border-gold-300/10 bg-black/20 px-3 py-3">
                  <AnswerBody answer={message.answer} onOpen={onOpen} />
                </div>
              ) : null
            )}
            {thinking ? <p className="text-xs text-gold-300">…</p> : null}
          </div>

          <div className="border-t border-gold-300/10 px-3 py-3">
            <p className="mb-2 text-[11px] text-mist-500">{t('assistant.suggestions')}</p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {suggestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => ask(question)}
                  className="cursor-pointer rounded-full border border-[#30363d] bg-[#161b22] px-2.5 py-1 text-start text-[11px] leading-5 text-gray-200 transition hover:border-blue-500/50 hover:text-white"
                >
                  {question}
                </button>
              ))}
            </div>
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                ask(draft)
              }}
            >
              <input
                ref={field}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={t('assistant.placeholder')}
                className="min-w-0 flex-1 rounded-full border border-gold-300/15 bg-black/30 px-3 py-2 text-sm text-mist-100 outline-none placeholder:text-mist-500 focus:border-gold-300/40"
              />
              <button
                type="submit"
                disabled={!draft.trim() || thinking}
                className="shrink-0 cursor-pointer rounded-full bg-gradient-to-b from-gold-300 to-gold-500 px-3 py-2 text-sm font-semibold text-ink-950 transition disabled:cursor-default disabled:opacity-40"
              >
                {t('assistant.send')}
              </button>
            </form>
          </div>
        </section>
      ) : null}

      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? t('assistant.close') : t('assistant.open')}
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-4 end-3 z-50 grid h-14 w-14 cursor-pointer place-items-center rounded-full border border-gold-300/40 bg-gradient-to-b from-gold-300 to-gold-500 text-ink-950 shadow-lift transition duration-300 hover:from-gold-300 hover:to-gold-400 sm:end-5"
      >
        {open ? (
          <span aria-hidden className="text-2xl leading-none">
            ×
          </span>
        ) : (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
            <path d="M6 17.5 4 21l3.6-1.6A8.5 8.5 0 1 0 6 17.5Z" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    </>
  )
}
