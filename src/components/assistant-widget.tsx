"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { askAssistant } from "@/app/actions/assistant";
import type { AssistantReply } from "@/services/assistant.service";

const examples = ["كم مبيعات اليوم؟", "كم مبيعات الشهر؟", "ما هي الأصناف الناقصة؟", "من هم أكثر العملاء مديونية؟", "متى ينفد المخزون؟"];

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text?: string; reply?: AssistantReply }>>([]);

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
    <div className="no-print fixed bottom-6 left-6 z-40">
      {open ? (
        <section className="mb-3 flex h-[32rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <header className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
            <p className="font-bold">المساعد الذكي للنظام</p>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1" aria-label="إغلاق المساعد">
              <X size={16} />
            </button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3">
            {messages.length === 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-slate-600">اسأل عن المبيعات أو النواقص أو المديونيات. الإجابة من قاعدة البيانات المحلية.</p>
                {examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-sm font-semibold text-slate-800"
                    onClick={() => send(example)}
                  >
                    {example}
                  </button>
                ))}
              </div>
            ) : (
              messages.map((message, index) =>
                message.role === "user" ? (
                  <p key={index} className="mr-8 rounded-2xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white">
                    {message.text}
                  </p>
                ) : (
                  <div key={index} className="rounded-2xl border border-slate-200 bg-white p-3 text-sm">
                    <p className="font-bold text-slate-900">{message.reply?.title}</p>
                    <p className="mt-1 text-slate-700">{message.reply?.summary}</p>
                    {message.reply?.rows && message.reply.columns ? (
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500">
                              {message.reply.columns.map((column) => (
                                <th key={column} className="px-1 py-1 text-right font-semibold">
                                  {column}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {message.reply.rows.map((row, rowIndex) => (
                              <tr key={rowIndex} className="border-b border-slate-200 last:border-0">
                                {row.map((cell, cellIndex) => (
                                  <td key={cellIndex} className="px-1 py-1">
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
            {pending ? <p className="text-sm font-semibold text-slate-500">جارٍ تحليل البيانات...</p> : null}
          </div>
          <form
            className="flex gap-2 border-t border-slate-200 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void send(text);
            }}
          >
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="اكتب سؤالك"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600"
            />
            <button type="submit" className="rounded-lg bg-blue-600 px-3 text-sm font-bold text-white" disabled={pending}>
              إرسال
            </button>
          </form>
        </section>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg"
      >
        <Sparkles size={16} />
        المساعد الذكي للنظام
      </button>
    </div>
  );
}
