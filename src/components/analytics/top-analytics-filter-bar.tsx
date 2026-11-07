"use client";

import React, { useMemo } from "react";

// ============================================================================
// 1. 8 VERIFIED ACTUAL OPERATIONAL BRANCHES (Jahra permanently removed)
// ============================================================================

export type PeriodOption = "day" | "month" | "year";

export interface BranchOption {
  id: string;
  nameEn: string;
  nameAr: string;
  code: string;
}

export const VENTURE_BRANCHES: BranchOption[] = [
  { id: "All branches", code: "ALL", nameEn: "All branches (8)", nameAr: "جميع الفروع (8)" },
  { id: "Salmiya", code: "SLM", nameEn: "Salmiya Branch", nameAr: "فرع السالمية" },
  { id: "Sharq", code: "SHQ", nameEn: "Sharq Branch", nameAr: "فرع شرق" },
  { id: "Hawally", code: "HWL", nameEn: "Hawally Branch", nameAr: "فرع حولي" },
  { id: "Al-Kout", code: "KOT", nameEn: "Al-Kout / Fahaheel", nameAr: "فرع الكوت / الفحيحيل" },
  { id: "Ardiya", code: "ARD", nameEn: "Ardiya Branch", nameAr: "فرع العارضية" },
  { id: "Farwaniya", code: "FRW", nameEn: "Farwaniya Branch", nameAr: "فرع الفروانية" },
  { id: "Mahboula", code: "MHB", nameEn: "Mahboula Branch", nameAr: "فرع المهبولة" },
  { id: "Mubarak Al-Kabeer", code: "QRN", nameEn: "Mubarak Al-Kabeer Branch", nameAr: "فرع مبارك الكبير" },
];

/** Canonical mapping of which real branches each brand operates in */
export const BRAND_OPERATING_BRANCHES: Record<string, string[]> = {
  "China Garden": ["Salmiya", "Sharq", "Hawally", "Al-Kout", "Ardiya", "Farwaniya", "Mahboula", "Mubarak Al-Kabeer"],
  "Frank's": ["Salmiya", "Sharq", "Ardiya", "Mubarak Al-Kabeer"],
  "Tahina": ["Sharq", "Al-Kout", "Ardiya", "Farwaniya", "Mubarak Al-Kabeer"],
  "Farm Brown": ["Al-Kout", "Ardiya", "Mahboula", "Mubarak Al-Kabeer"],
  "The Noodle Bar": ["Salmiya", "Hawally", "Mahboula", "Mubarak Al-Kabeer"],
  "Karak Cafeteria": ["Salmiya", "Hawally", "Farwaniya", "Mubarak Al-Kabeer"],
};

/** Canonical mapping of which sales channels each brand operates on */
export const BRAND_OPERATING_CHANNELS: Record<string, string[]> = {
  "China Garden": ["Shop Sales", "Talabat Go", "Keeta", "Talabat TMP", "Deliveroo Core", "Ordable", "Snoonu", "Jahez", "Phone", "Deliveroo TMP"],
  "Frank's": ["Talabat Go", "Deliveroo Core", "Shop Sales", "Keeta", "Talabat TMP"],
  "Tahina": ["Shop Sales", "Talabat Go", "Keeta"],
  "Farm Brown": ["Shop Sales", "Talabat Go", "Keeta"],
  "The Noodle Bar": ["Talabat TMP", "Shop Sales", "Keeta", "Talabat Go"],
  "Karak Cafeteria": ["Shop Sales", "Whatsapp"],
};

export const PERIOD_MULTIPLIERS: Record<
  PeriodOption,
  { labelEn: string; labelAr: string; factor: number }
> = {
  day: { labelEn: "Daily (Day)", labelAr: "اليومي (Day)", factor: 1 / 31 },
  month: { labelEn: "Monthly (Month)", labelAr: "الشهر (Month)", factor: 1 },
  year: { labelEn: "Yearly (Year)", labelAr: "السنة (Year)", factor: 12 },
};

// Helper Badge for Tgo & TMP inside Table Cells
export function DeliveryModeBadge({ mode }: { mode: "Tgo" | "TMP" | "Direct" | string }) {
  const normalized = mode === "M" || mode === "MP" ? "TMP" : mode;

  if (normalized === "TMP") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 ring-1 ring-indigo-500/25 tracking-tight">
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
      className="bg-white dark:bg-[#111827] rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-slate-200/70 dark:ring-slate-800 transition-all duration-150"
    >
      <div className="flex flex-wrap items-center gap-3">
        {/* 1. Brand Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {isAr ? "العلامة (Brand)" : "Brand"}
          </label>
          <select
            value={selectedBrand}
            onChange={(e) => handleBrandChange(e.target.value)}
            className="rounded-xl bg-[#F7F7F8] dark:bg-slate-800/90 hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 text-[13px] font-semibold px-3.5 py-2 ring-1 ring-slate-200/80 dark:ring-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 transition cursor-pointer"
          >
            <option value="All brands">{isAr ? "جميع العلامات (6)" : "All brands (6)"}</option>
            {brandsList.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Branches Selector (Cascading Real Filter: Only real branches where the brand operates) */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {isAr ? "الفرع (Branches)" : "Branches"}
          </label>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="rounded-xl bg-[#F7F7F8] dark:bg-slate-800/90 hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 text-[13px] font-semibold px-3.5 py-2 ring-1 ring-slate-200/80 dark:ring-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 transition cursor-pointer"
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
            {isAr ? "القناة (Channel)" : "Channel"}
          </label>
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="rounded-xl bg-[#F7F7F8] dark:bg-slate-800/90 hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 text-[13px] font-semibold px-3.5 py-2 ring-1 ring-slate-200/80 dark:ring-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 transition cursor-pointer"
          >
            <option value="All channels">{isAr ? "جميع القنوات (11)" : "All channels (11)"}</option>
            {channelsList.map((c) => {
              const displayChannel = c.replace(/\bMP\b|\bM\b/g, "TMP");
              const isOperating =
                selectedBrand === "All brands" ||
                !BRAND_OPERATING_CHANNELS[selectedBrand] ||
                BRAND_OPERATING_CHANNELS[selectedBrand].includes(c);
              return (
                <option key={c} value={c}>
                  {displayChannel} {!isOperating ? (isAr ? "(لا يعمل)" : "(0)") : ""}
                </option>
              );
            })}
          </select>
        </div>

        {/* 4. Date / Period Selector (Day - Month - Year linked to verified records) */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {isAr ? "الفترة (Date)" : "Date"}
          </label>
          <div className="inline-flex items-center rounded-xl bg-[#F7F7F8] dark:bg-slate-800/90 p-1 ring-1 ring-slate-200/80 dark:ring-slate-700">
            {(["day", "month", "year"] as PeriodOption[]).map((periodKey) => {
              const active = selectedPeriod === periodKey;
              const labels = {
                day: isAr ? "اليومي" : "Day",
                month: isAr ? "الشهر" : "Month",
                year: isAr ? "السنة" : "Year",
              };
              return (
                <button
                  key={periodKey}
                  type="button"
                  onClick={() => setSelectedPeriod(periodKey)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all duration-150 ${
                    active
                      ? "bg-[#2563EB] text-white shadow-2xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
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
            className="ms-auto rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-bold px-3.5 py-2 ring-1 ring-rose-200 dark:ring-rose-800/60 hover:bg-rose-100 transition"
          >
            {isAr ? "إعادة ضبط الفلاتر ✕" : "Reset filters ✕"}
          </button>
        )}
      </div>
    </div>
  );
}
