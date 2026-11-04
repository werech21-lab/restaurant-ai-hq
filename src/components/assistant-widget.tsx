"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { askAssistant } from "@/app/actions/assistant";
import type { AssistantReply } from "@/services/assistant.service";
import { useI18n } from "@/lib/i18n";

const examplesAr = ["كم مبيعات اليوم؟", "كم مبيعات الشهر؟", "ما هي الأصناف الناقصة؟", "من هم أكثر العملاء مديونية؟", "متى ينفد المخزون؟"];
const examplesEn = [
  "What are today’s sales?",
  "What are this month’s sales?",
  "Which items are low on stock?",
  "Who are the top debtors?",
  "When will stock run out?",
];

export function AssistantWidget() {
  const { locale } = useI18n();
  const en = locale === "en";
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text?: string; reply?: AssistantReply }>>([]);
  const examples = en ? examplesEn : examplesAr;

  async function send(value: string) {
    const question = value.trim();
    if (!question || pending) return;
    setText("");
    setMessages((current) => [...current, { role: "user", text: question }]);
    setPending(true);
    try {
      const reply = await askAssistant(question);
      setMessages((current) => [...current, { role: "assistant", reply }]);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="no-print fixed bottom-5 left-5 z-40">
      {open ? (
        <section className="mb-3 flex h-[30rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
          <header className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/80 px-4 py-3 text-slate-900 dark:text-white">
            <div className="flex items-center gap-2">
              <Search size={16} className="text-slate-600 dark:text-slate-300" />
              <p className="font-bold text-sm">{en ? "Quick Database Query" : "الاستعلام السريع"}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white"
              aria-label={en ? "Close query" : "إغلاق الاستعلام"}
            >
              <X size={16} />
            </button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 dark:bg-slate-950/60 p-3">
            {messages.length === 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {en
                    ? "Direct query for sales, stock levels, or ledger entries from company records."
                    : "استعلام فوري ومباشر عن المبيعات أو المخزون أو القيود الحسابية المسجلة."}
                </p>
                {examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    className={`block w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-600 transition-colors ${en ? "text-left" : "text-right"}`}
                    onClick={() => send(example)}
                  >
                    {example}
                  </button>
                ))}
              </div>
            ) : (
              messages.map((message, index) =>
                message.role === "user" ? (
                  <p key={index} className="mr-8 rounded-2xl bg-slate-800 text-white dark:bg-slate-700 px-3 py-2 text-xs font-semibold">
                    {message.text}
                  </p>
                ) : (
                  <div key={index} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 text-xs">
                    <p className="font-bold text-slate-900 dark:text-white">{message.reply?.title}</p>
                    <p className="mt-1 text-slate-700 dark:text-slate-300">{message.reply?.summary}</p>
                    {message.reply?.rows && message.reply.columns ? (
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500">
                              {message.reply.columns.map((column) => (
                                <th key={column} className="px-1 py-1 text-right font-semibold">
                                  {column}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {message.reply.rows.map((row, rowIndex) => (
                              <tr key={rowIndex} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                                {row.map((cell, cellIndex) => (
                                  <td key={cellIndex} className="px-1 py-1 text-slate-800 dark:text-slate-200">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                ),
              )
            )}
            {pending ? (
              <p className="text-xs font-semibold text-slate-500">{en ? "Querying database…" : "جارٍ استرجاع البيانات..."}</p>
            ) : null}
          </div>
          <form
            className="flex gap-2 border-t border-slate-200 dark:border-slate-800 p-2.5 bg-white dark:bg-slate-900"
            onSubmit={(event) => {
              event.preventDefault();
              void send(text);
            }}
          >
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={en ? "Type search query…" : "اكتب استعلامك هنا..."}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs outline-none focus:border-slate-500"
            />
            <button type="submit" className="rounded-lg bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 px-3 text-xs font-bold text-white transition-colors" disabled={pending}>
              {en ? "Search" : "بحث"}
            </button>
          </form>
        </section>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 shadow-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
      >
        <Search size={14} className="text-slate-600 dark:text-slate-400" />
        {en ? "Quick Query" : "الاستعلام السريع"}
      </button>
    </div>
  );
}
