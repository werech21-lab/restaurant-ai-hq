"use client";

import React, { useMemo } from "react";
import { ODOO } from "@/lib/odoo/odoo-dataset";

// ============================================================================
// 1. ODOO LOCATIONS (positive pos.config whitelist) — restaurants, then EXB and school canteens
// ============================================================================

export type PeriodOption = "day" | "month" | "year";

export interface BranchOption {
  id: string;
  nameEn: string;
  nameAr: string;
  code: string;
}

const LOCATIONS = [...ODOO.restaurants, ...ODOO.exhibitions, ...ODOO.canteens];

export const VENTURE_BRANCHES: BranchOption[] = [
  { id: "All branches", code: "ALL", nameEn: `All locations (${LOCATIONS.length})`, nameAr: `جميع المواقع (${LOCATIONS.length})` },
  ...LOCATIONS.map((l) => ({ id: l.id, code: l.code, nameEn: l.en, nameAr: l.ar })),
];

const BRAND_NAME: Record<string, string> = Object.fromEntries(ODOO.brands.map((b) => [b.id, b.en]));
const CHANNEL_NAME: Record<string, string> = Object.fromEntries(ODOO.channels.map((c) => [c.id, c.odooName]));

/** Odoo: locations where each brand recorded sales in the period. */
export const BRAND_OPERATING_BRANCHES: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  for (const r of ODOO.brandLocation) (out[BRAND_NAME[r.brand]] ||= []).push(r.location);
  return out;
})();

/** Odoo: channels through which each brand recorded sales in the period. */
export const BRAND_OPERATING_CHANNELS: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {};
  for (const r of ODOO.brandChannel) (out[BRAND_NAME[r.brand]] ||= []).push(CHANNEL_NAME[r.channel]);
  return out;
})();

/** Arabic display names for the approved Odoo brands (filter values stay canonical). */
export const BRAND_LABEL_AR: Record<string, string> = Object.fromEntries(ODOO.brands.map((b) => [b.en, b.ar]));

/** Arabic display names for the Odoo sales channels. */
export const CHANNEL_LABEL_AR: Record<string, string> = {
  ...Object.fromEntries(ODOO.channels.map((c) => [c.odooName, c.ar])),
  "Talabat TMP": "سوق طلبات (TMP)",
  "Deliveroo TMP": "ديليفرو ماركت (TMP)",
};

export const PERIOD_MULTIPLIERS: Record<
  PeriodOption,
  { labelEn: string; labelAr: string; factor: number }
> = {
  day: { labelEn: "Daily", labelAr: "يومي", factor: 1 / 31 },
  month: { labelEn: "Monthly", labelAr: "شهري", factor: 1 },
  year: { labelEn: "Yearly", labelAr: "سنوي", factor: 12 },
};

// Helper Badge for Tgo & TMP inside Table Cells
export function DeliveryModeBadge({ mode }: { mode: "Tgo" | "TMP" | "Direct" | string }) {
  const normalized = mode === "M" || mode === "MP" ? "TMP" : mode;

  if (normalized === "TMP") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-sky-50 text-sky-700 dark:bg-sky-950/80 dark:text-sky-300 ring-1 ring-sky-500/25 tracking-tight">
        TMP
      </span>
    );
  }

  if (normalized === "Tgo") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 ring-1 ring-amber-500/25 tracking-tight">
        Tgo
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
      {normalized}
    </span>
  );
}

// ============================================================================
// 2. TOP FILTER BAR COMPONENT WITH CASCADING REAL FILTERS (NO SYNTHETIC RATIOS)
// ============================================================================

export interface TopFilterBarProps {
  lang: "ar" | "en";
  selectedBrand: string;
  setSelectedBrand: (v: string) => void;
  selectedBranch: string;
  setSelectedBranch: (v: string) => void;
  selectedChannel: string;
  setSelectedChannel: (v: string) => void;
  selectedPeriod: PeriodOption;
  setSelectedPeriod: (v: PeriodOption) => void;
  brandsList: string[];
  channelsList: string[];
}

const SELECT_CLS =
  "ae-select min-w-0 focus:outline-none focus:ring-2 focus:ring-sky-500/40 transition";

export function TopAnalyticsFilterBar({
  lang,
  selectedBrand,
  setSelectedBrand,
  selectedBranch,
  setSelectedBranch,
  selectedChannel,
  setSelectedChannel,
  selectedPeriod,
  setSelectedPeriod,
  brandsList,
  channelsList,
}: TopFilterBarProps) {
  const isAr = lang === "ar";

  // Cascading Real Filter: Only display real branches where this brand operates
  const availableBranches = useMemo(() => {
    if (selectedBrand === "All brands" || !BRAND_OPERATING_BRANCHES[selectedBrand]) {
      return VENTURE_BRANCHES;
    }
    const allowed = new Set(BRAND_OPERATING_BRANCHES[selectedBrand]);
    return VENTURE_BRANCHES.filter((b) => b.id === "All branches" || allowed.has(b.id));
  }, [selectedBrand]);

  // Handle brand selection: cascade-reset branch and channel if not valid for selected brand
  const handleBrandChange = (newBrand: string) => {
    setSelectedBrand(newBrand);
    if (newBrand !== "All brands" && BRAND_OPERATING_BRANCHES[newBrand]) {
      const allowedBranches = BRAND_OPERATING_BRANCHES[newBrand];
      if (selectedBranch !== "All branches" && !allowedBranches.includes(selectedBranch)) {
        setSelectedBranch("All branches");
      }
      const allowedChannels = BRAND_OPERATING_CHANNELS[newBrand];
      if (allowedChannels && selectedChannel !== "All channels" && !allowedChannels.includes(selectedChannel)) {
        setSelectedChannel("All channels");
      }
    }
  };

  const hasActiveFilter =
    selectedBrand !== "All brands" ||
    selectedBranch !== "All branches" ||
    selectedChannel !== "All channels" ||
    selectedPeriod !== "month";

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className="ae-tile rounded-2xl p-3.5 transition-all duration-150"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {/* 1. Brand Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {isAr ? "العلامة" : "Brand"}
          </label>
          <select
            value={selectedBrand}
            onChange={(e) => handleBrandChange(e.target.value)}
            className={SELECT_CLS}
          >
            <option value="All brands">{isAr ? `جميع العلامات (${brandsList.length})` : `All brands (${brandsList.length})`}</option>
            {brandsList.map((b) => (
              <option key={b} value={b}>
                {isAr ? BRAND_LABEL_AR[b] ?? b : b}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Branches Selector (Cascading Real Filter: Only real branches where the brand operates) */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {isAr ? "الفرع" : "Branch"}
          </label>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className={SELECT_CLS}
          >
            {availableBranches.map((br) => (
              <option key={br.id} value={br.id}>
                {isAr ? br.nameAr : br.nameEn}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Channel Selector (With TMP instead of MP/M) */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {isAr ? "القناة" : "Channel"}
          </label>
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className={SELECT_CLS}
          >
            <option value="All channels">{isAr ? `جميع القنوات (${channelsList.length})` : `All channels (${channelsList.length})`}</option>
            {channelsList.map((c) => {
              const displayChannel = isAr ? CHANNEL_LABEL_AR[c] ?? c.replace(/\bMP\b|\bM\b/g, "TMP") : c.replace(/\bMP\b|\bM\b/g, "TMP");
              const isOperating =
                selectedBrand === "All brands" ||
                !BRAND_OPERATING_CHANNELS[selectedBrand] ||
                BRAND_OPERATING_CHANNELS[selectedBrand].includes(c);
              return (
                <option key={c} value={c}>
                  {displayChannel} {!isOperating ? (isAr ? "(لا يعمل)" : "(inactive)") : ""}
                </option>
              );
            })}
          </select>
        </div>

        {/* 4. Date / Period Selector (Day - Month - Year linked to verified records) */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {isAr ? "الفترة" : "Period"}
          </label>
          <div className="ae-seg" role="group" aria-label={isAr ? "الفترة" : "Period"}>
            {(["day", "month", "year"] as PeriodOption[]).map((periodKey) => {
              const active = selectedPeriod === periodKey;
              const labels = {
                day: isAr ? "يومي" : "Day",
                month: isAr ? "شهري" : "Month",
                year: isAr ? "سنوي" : "Year",
              };
              return (
                <button
                  key={periodKey}
                  type="button"
                  onClick={() => setSelectedPeriod(periodKey)}
                  data-active={active ? "true" : "false"}
                  aria-pressed={active}
                >
                  {labels[periodKey]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Reset All Filters Button */}
        {hasActiveFilter && (
          <button
            type="button"
            onClick={() => {
              setSelectedBrand("All brands");
              setSelectedBranch("All branches");
              setSelectedChannel("All channels");
              setSelectedPeriod("month");
            }}
            className="ae-pill-light ae-pill-sm ms-auto"
          >
            {isAr ? "إعادة ضبط الفلاتر ✕" : "Reset filters ✕"}
          </button>
        )}
      </div>
    </div>
  );
}
