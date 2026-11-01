"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSalesInvoice } from "@/app/actions/sales";
import { Alert, fieldClass } from "@/components/erp-ui";
import { formatMoney, formatQty } from "@/lib/format";
import { enqueueSale, listQueued, removeQueued } from "@/lib/offline-pos";

type PosProduct = {
  id: string;
  code: string;
  name: string;
  category: string;
  price: number;
  stock: number;
};

type CartLine = { product: PosProduct; quantity: number };

export function PosTerminal({
  products,
  walkInId,
  customers,
}: {
  products: PosProduct[];
  walkInId: string;
  customers: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const categories = useMemo(() => ["الكل", ...Array.from(new Set(products.map((product) => product.category)))], [products]);
  const [category, setCategory] = useState("الكل");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [method, setMethod] = useState<"CASH" | "CARD" | "CREDIT">("CASH");
  const [customerId, setCustomerId] = useState(walkInId);
  const [tendered, setTendered] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [queued, setQueued] = useState(0);

  useEffect(() => {
    let alive = true;
    async function flush() {
      const rows = await listQueued().catch(() => []);
      if (!alive) return;
      setQueued(rows.length);
      if (!navigator.onLine || rows.length === 0) return;
      for (const row of rows) {
        const result = await createSalesInvoice({
          partyId: row.partyId,
          paidAmount: row.paidAmount,
          discount: 0,
          paymentMethod: row.paymentMethod,
          source: "pos",
          items: row.items,
        }).catch(() => null);
        if (!result?.ok) break;
        await removeQueued(row.id);
      }
      const left = await listQueued().catch(() => []);
      if (alive) setQueued(left.length);
    }
    flush();
    const onOnline = () => flush();
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "POS_SYNC") flush();
    };
    window.addEventListener("online", onOnline);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      alive = false;
      window.removeEventListener("online", onOnline);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, []);

  const visible = products.filter((product) => {
    const inCategory = category === "الكل" || product.category === category;
    const text = query.trim();
    const matches = !text || product.name.includes(text) || product.code.toLowerCase().includes(text.toLowerCase());
    return inCategory && matches;
  });
  const total = cart.reduce((sum, line) => sum + line.quantity * line.product.price, 0);
  const change = method === "CASH" ? Math.max((Number(tendered) || 0) - total, 0) : 0;

  function add(product: PosProduct) {
    setCart((current) => {
      const existing = current.find((line) => line.product.id === product.id);
      if (existing) {
        return current.map((line) => (line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line));
      }
      return [...current, { product, quantity: 1 }];
    });
  }

  function onBarcode(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const code = query.trim().toLowerCase();
    const product = products.find((item) => item.code.toLowerCase() === code);
    if (product) {
      add(product);
      setQuery("");
    }
  }

  async function checkout() {
    setError("");
    if (cart.length === 0) {
      setError("السلة فارغة");
      return;
    }
    const partyId = method === "CREDIT" ? customerId : walkInId || customerId;
    if (!partyId) {
      setError("عميل الصندوق غير موجود. أعد تشغيل التغذية.");
      return;
    }
    if (method === "CREDIT" && partyId === walkInId) {
      setError("اختر عميلاً للبيع الآجل");
      return;
    }
    const payload = {
      partyId,
      paidAmount: method === "CREDIT" ? 0 : total,
      paymentMethod: method,
      items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity, price: line.product.price })),
    };
    if (!navigator.onLine) {
      await enqueueSale({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...payload });
      setCart([]);
      setQueued((count) => count + 1);
      setNotice("انقطع الاتصال. حُفظت الفاتورة على الجهاز وستُزامَن تلقائياً عند عودة الإنترنت.");
      return;
    }
    setPending(true);
    let result: Awaited<ReturnType<typeof createSalesInvoice>> | null = null;
    try {
      result = await createSalesInvoice({ ...payload, discount: 0, source: "pos" });
    } catch {
      await enqueueSale({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...payload });
      setPending(false);
      setCart([]);
      setQueued((count) => count + 1);
      setNotice("تعذر الوصول للسيرفر. حُفظت الفاتورة محلياً وستُرسل عند عودة الاتصال.");
      return;
    }
    setPending(false);
    if (!result.ok || !result.id) {
      setError(result.ok ? "تعذر إصدار الإيصال" : result.message);
      return;
    }
    router.push(`/sales/${result.id}/print?layout=thermal`);
  }

  return (
    <div className="flex min-h-screen flex-col pb-16 md:h-screen md:pb-0">
      <header className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
        <a href="/dashboard" className="text-sm font-semibold text-white">
          العودة للنظام
        </a>
        <p className="font-bold">نقطة البيع · AetherBI ERP</p>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_380px]">
        <section className="min-h-0 overflow-y-auto p-4">
          <input
            id="pos-search"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onBarcode}
            placeholder="بحث فوري أو امسح الباركود ثم Enter"
            className={`${fieldClass} mb-3`}
          />
          <div className="mb-3 flex flex-wrap gap-2">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                className={item === category ? "rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white" : "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {visible.map((product) => (
              <button
                key={product.id}
                type="button"
                className="rounded-2xl border border-slate-200 bg-white p-3 text-right"
                onClick={() => add(product)}
              >
                <p className="font-bold">{product.name}</p>
                <p className="text-xs text-slate-500" dir="ltr">{product.code}</p>
                <p className="mt-2 text-sm font-bold text-blue-700">{formatMoney(product.price)}</p>
                <p className="text-xs">المتوفر {formatQty(product.stock)}</p>
              </button>
            ))}
          </div>
        </section>
        <aside className="flex min-h-0 flex-col border-t border-slate-200 bg-white p-4 lg:border-t-0 lg:border-r">
          {error ? <Alert kind="error">{error}</Alert> : null}
          {notice ? <Alert kind="ok">{notice}</Alert> : null}
          {queued > 0 ? <p className="mt-2 text-sm font-semibold text-amber-700">فواتير بانتظار المزامنة: {queued}</p> : null}
          <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto">
            {cart.map((line) => (
              <div key={line.product.id} className="rounded-xl border border-slate-200 p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{line.product.name}</p>
                  <button type="button" className="text-sm text-red-600" onClick={() => setCart((current) => current.filter((item) => item.product.id !== line.product.id))}>
                    حذف
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button type="button" className="h-8 w-8 rounded-lg border border-slate-200" onClick={() => setCart((current) => current.map((item) => item.product.id === line.product.id ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item))}>-</button>
                    <span className="font-bold">{formatQty(line.quantity)}</span>
                    <button type="button" className="h-8 w-8 rounded-lg border border-slate-200" onClick={() => setCart((current) => current.map((item) => item.product.id === line.product.id ? { ...item, quantity: item.quantity + 1 } : item))}>+</button>
                  </div>
                  <p className="font-bold">{formatMoney(line.quantity * line.product.price)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
            <p className="text-xl font-bold">الإجمالي {formatMoney(total)}</p>
            <div className="grid grid-cols-3 gap-2">
              {(["CASH", "CARD", "CREDIT"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={method === item ? "rounded-lg bg-blue-600 px-2 py-2 text-sm font-bold text-white" : "rounded-lg border border-slate-200 px-2 py-2 text-sm font-bold"}
                  onClick={() => setMethod(item)}
                >
                  {item === "CASH" ? "نقدي" : item === "CARD" ? "بطاقة" : "آجل"}
                </button>
              ))}
            </div>
            {method === "CREDIT" ? (
              <select className={fieldClass} value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                {customers.filter((customer) => customer.id !== walkInId).map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </select>
            ) : null}
            {method === "CASH" ? (
              <div>
                <input dir="ltr" className={fieldClass} placeholder="المبلغ المستلم" value={tendered} onChange={(event) => setTendered(event.target.value)} />
                <p className="mt-1 text-sm font-semibold">الباقي {formatMoney(change)}</p>
              </div>
            ) : null}
            {method === "CARD" ? <p className="text-sm text-slate-600">كي نت / مدى / فيزا — يُرحّل على حساب البنك والبطاقات.</p> : null}
            <button type="button" className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white disabled:opacity-60" disabled={pending} onClick={checkout}>
              {pending ? "جارٍ الإصدار..." : "إصدار الإيصال"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
