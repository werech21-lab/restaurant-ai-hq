# Reconciliation — 2026-11-01 → 2026-11-17 vs Owner Reference (66,487.040 KWD)

- **Phase / Item**: Phase 1 · Item 1.5 (`C7`)
- **Window**: `2026-11-01` → `2026-11-17` inclusive (`Asia/Kuwait`, UTC+3; Odoo UTC bounds `2026-10-31 21:00:00` → `2026-11-17 21:00:00` exclusive)
- **Odoo Query Specification**: `pos.order.read_group` grouped by `config_id` (`state in ['paid', 'done', 'invoiced']`, `net = amount_total − amount_tax`, `context: { active_test: false }`)
- **Owner Reference**: **66,487.040 KWD**
- **Policy**: Diagnostic only — app totals and `src/lib/odoo/pos-registry.json` are **NOT** modified without the owner's explicit decision.

---

## 1. Live Odoo `pos.order.read_group` Capture Status

- **Live per-`config_id` read status in CI / clean sandbox**: **غير متاح / Not available** (`.env.local` live Odoo credentials are intentionally untracked and absent outside the owner's Mac).
- **One-liner for the Owner on the Mac** (strictly read-only RPCs `fields_get | search_count | search_read | read_group | read`; zero credential/URL logging; automatically overwrites this file with the live per-register `pos.order.read_group` table):

```bash
node scripts/run-mac-readonly-probes.mjs
```

*(Or standalone for 1.5 only: `node scripts/audit-pos-variance.mjs --from 2026-11-01 --to 2026-11-17 --owner-ref 66487.04 --write-redo-doc`.)*

---

## 2. Exact Variance Decomposition from Verified Reference Figures

From the owner's verified reference figures (`ANTIGRAVITY-MASTER-PROMPT.md` lines 58 & 91):

| Basis | Net Sales (KWD) | Delta vs Owner Reference (`66,487.040`) | Proven Explanation |
|---|---:|---:|---|
| **Owner Reference (1–17 Nov)** | **66,487.040** | `0.000` | Owner reference baseline |
| **App Total without Exhibition Booths** (live 18 Nov 07:10 KWT) | **66,729.431** | **`+242.391`** | Active restaurants + school canteens (`900.150` KWD across `#41, #42, #43`) + whitelisted registers `#16` / `#35` (archived in Odoo; see Section 3) |
| **App Total with Exhibition Booths** (live 18 Nov 07:10 KWT) | **69,208.031** | **`+2,720.991`** | Exact sum of `66,729.431` + **`2,478.600` KWD** (`669` orders) on Exhibition Booths `pos.config` `26–33, 37, 38` (`69,208.031 − 66,729.431 = 2,478.600`) |

### Cached Repo Payload Cross-Check (`src/lib/__tests__/fixtures/dashboard-today-2026-11-17.json`)

Captured at `2026-11-17T03:00:36.564Z` (`06:00:36 KWT` on 17 Nov — before full-day 17 Nov trading closed and before booth/canteen group keys were split out of `dailyUnattributed`):

| Cached Location (`2026-11-01` → `2026-11-17` 06:00 KWT) | Orders | Net Sales (KWD) |
|---|---:|---:|
| `360-mall` (`#17, #18`) | 2,177 | 11,999.541 |
| `promenade` (`#8, #9, #10, #11, #16`) | 2,240 | 11,679.764 |
| `ardiya` (`#3, #23, #35`) | 1,553 | 10,238.545 |
| `salmiya` (`#19, #20`) | 1,328 | 8,937.035 |
| `assima` (`#14, #15`) | 1,525 | 7,890.241 |
| `al-kout` (`#21, #22`) | 2,603 | 7,347.839 |
| `avenues` (`#34`) | 1,416 | 5,088.923 |
| `unattributed` (pre-split booths/canteens in 17 Nov 06:00 cache) | 2,221 | 2,934.800 |
| **Cached Total (`2026-11-01` → `2026-11-17` 06:00 KWT)** | **15,063** | **66,116.688** |

---

## 3. Config-by-Config Register Classification (`src/lib/odoo/pos-registry.json`)

`scripts/lib/pos-variance-lib.mjs` (`classifyRegister` & `buildVarianceReport`) queries `pos.config` with `context: { active_test: false }` so archived and non-whitelisted registers are never hidden when explaining the `+242.391 KWD` delta (`66,729.431 − 66,487.040`):

| `pos.config` ID(s) | Current `pos-registry.json` Mapping | Reconciliation Bucket (`pos-variance-lib.mjs`) | 1–17 Nov Live `read_group` Net KWD | Notes for Owner Decision |
|---|---|---|---|---|
| `#3, #23` | `ardiya` (`restaurant`) | `active-restaurant` | غير متاح (pending Mac run) | Active Ardiya registers |
| `#8, #9, #10, #11` | `promenade` (`restaurant`) | `active-restaurant` | غير متاح (pending Mac run) | Active Promenade (Hawally) registers |
| `#14, #15` | `assima` (`restaurant`) | `active-restaurant` | غير متاح (pending Mac run) | Active Assima Mall registers |
| `#17, #18` | `360-mall` (`restaurant`) | `active-restaurant` | غير متاح (pending Mac run) | Active 360 Mall registers |
| `#19, #20` | `salmiya` (`restaurant`) | `active-restaurant` | غير متاح (pending Mac run) | Active Salmiya registers |
| `#21, #22` | `al-kout` (`restaurant`) | `active-restaurant` | غير متاح (pending Mac run) | Active Al Kout registers |
| `#34` | `avenues` (`restaurant`) | `active-restaurant` | غير متاح (pending Mac run) | Active Avenues register |
| **`#16`** | `promenade` (currently in `allowedPosConfigIds`) | **`archived-whitelisted`** (when `active=false` in Odoo) | غير متاح (pending Mac run) | Archived Promenade register — candidate contributor to `+242.391 KWD` if orders were posted in 1–17 Nov while owner's report filtered `config_id.active = true` |
| **`#35`** | `ardiya` (currently in `allowedPosConfigIds`) | **`archived-whitelisted`** (when `active=false` in Odoo) | غير متاح (pending Mac run) | Archived temporary Ardiya delivery register — separated from `restaurantsOnly` by `classifyRegister` |
| **`#36`** | *Not in `pos-registry.json`* (gap between `#35` and `#37`) | **`unknown-unmapped`** | غير متاح (pending Mac run) | Explicitly surfaced by `scripts/audit-pos-variance.mjs` (`lines 194-203`) even if archived or deleted in Odoo |
| `#26–#33, #37, #38` | `exhibitions` (`exhibition`) | `exhibition-booths` | **2,478.600** (`669` orders at 18 Nov 07:10 KWT) | Exact `69,208.031 − 66,729.431` difference (`EXB` = Exhibition Booths, never a kitchen) |
| `#41, #42, #43` | `school-canteens` (`canteen`) | `school-canteens` | **900.150** (`2,872` orders at 18 Nov 07:10 KWT) | `#41` NPIS Hawally, `#42` FAIPS Ahmadi, `#43` FAS Fahaheel |
| `#24, #25, #39, #40` | Explicit `ODOO_EXCLUSION_RULES` (`pos_config`) | `explicit-excluded` | غير متاح (excluded; verified `0` in app) | `#24` decommissioned, `#25/#39` Jahra, `#40` inactive |
| Qurain POS register(s) | Excluded pending `1.4` double-count audit | `qurain-central-kitchen` | غير متاح (pending Mac run) | Kept «غير متاح» until `qurain-audit-2026-11-01_2026-11-17.json` is generated & reviewed |
