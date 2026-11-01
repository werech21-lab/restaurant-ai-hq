"use client";

import { useEffect, useState } from "react";
import { fieldClass, labelClass } from "@/components/erp-ui";
import type { SearchHit } from "@/lib/types";

export function SearchSelect({
  label,
  placeholder,
  selectedLabel,
  search,
  onSelect,
}: {
  label: string;
  placeholder: string;
  selectedLabel?: string;
  search: (query: string) => Promise<SearchHit[]>;
  onSelect: (hit: SearchHit) => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      search(query)
        .then((rows) => {
          if (!cancelled) setHits(rows);
        })
        .catch(() => {
          if (!cancelled) setHits([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query, search]);

  return (
    <div className="relative">
      <label className={labelClass}>{label}</label>
      <input
        className={fieldClass}
        placeholder={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
      />
      {selectedLabel ? <p className="mt-1 text-xs font-semibold text-blue-700">المحدد: {selectedLabel}</p> : null}
      {open ? (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {loading ? <p className="px-3 py-2 text-sm text-slate-600">جارٍ البحث...</p> : null}
          {!loading && hits.length === 0 ? <p className="px-3 py-2 text-sm text-slate-600">لا توجد نتائج</p> : null}
          {hits.map((hit) => (
            <button
              type="button"
              key={hit.id}
              className="block w-full px-3 py-2 text-right text-sm hover:bg-slate-50"
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect(hit);
                setQuery("");
                setOpen(false);
              }}
            >
              <span className="font-semibold text-slate-900">{hit.label}</span>
              {hit.meta ? <span className="mr-2 text-slate-500">{hit.meta}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
