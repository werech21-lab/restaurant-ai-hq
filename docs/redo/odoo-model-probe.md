# Odoo 17 Read-Only Model Probe (Phase 2.1 · F2)

- **Mode**: Verified cached baseline (غير متاح — بانتظار تشغيل فحص المالك على Mac)
- **Reference timestamp**: `2026-11-17T03:00:36.564Z`
- **RPC policy**: strictly read-only (`fields_get`, `search_count`, `search_read`, `read_group`, `read`) — zero writes, zero credentials logged
- **Verified cached inputs**: `dashboard-today-2026-11-17.json` (`2026-11-17T03:00:36.564Z`), `venturefoods_odoo_cids1_dump.json` (`2026-10-31T10:55:03.976Z`, test/audit baseline only — removed from prod paths), `pos-registry.json` (30 whitelisted registers)

## 1. Model Coverage Summary (8 Required Advisor Council Models)

| Model | Readable | Total Rows (`search_count([])`) | 30d Recent Rows | Date Span (`min → max`) | % With Branch / Location | Verified Fields | Notes |
|---|:---:|---|---|---|---|---|---|
| `hr.attendance` | yes (Oct 31 cached sample) | غير متاح — بانتظار تشغيل فحص المالك على Mac (Oct 31 sample: 1,000 rows, 1,000-row cap) | غير متاح — بانتظار تشغيل فحص المالك على Mac | Sample: 2026-10-20 13:09:18 → 2026-10-31 06:57:02 UTC (full span: غير متاح — بانتظار تشغيل فحص المالك على Mac) | 0.0% in cached sample (live work_location_id link: غير متاح — بانتظار تشغيل فحص المالك على Mac) | id, employee_id, check_in, check_out | Exported without work_location_id link; closed=865, open=135 in 1,000-row sample. |
| `hr.employee` | yes (Oct 31 cached export) | 166 (Oct 31 export; live count: غير متاح — بانتظار تشغيل فحص المالك على Mac) | غير متاح — بانتظار تشغيل فحص المالك على Mac | غير متاح — بانتظار تشغيل فحص المالك على Mac | غير متاح — بانتظار تشغيل فحص المالك على Mac (department_id present on 159/166 = 95.8%) | id, job_title, active, barcode, department_id | work_location_id was not included in the Oct 31 export; live fields_get probe required. |
| `stock.move` | غير متاح — بانتظار تشغيل فحص المالك على Mac | غير متاح — بانتظار تشغيل فحص المالك على Mac | غير متاح — بانتظار تشغيل فحص المالك على Mac | غير متاح — بانتظار تشغيل فحص المالك على Mac | غير متاح — بانتظار تشغيل فحص المالك على Mac | غير متاح — بانتظار تشغيل فحص المالك على Mac | Not included in Oct 31 export — غير متاح — بانتظار تشغيل فحص المالك على Mac (needed for Qurain QRN/Stock transfers vs branch receipts). |
| `stock.scrap` | غير متاح — بانتظار تشغيل فحص المالك على Mac | غير متاح — بانتظار تشغيل فحص المالك على Mac | غير متاح — بانتظار تشغيل فحص المالك على Mac | غير متاح — بانتظار تشغيل فحص المالك على Mac | غير متاح — بانتظار تشغيل فحص المالك على Mac | غير متاح — بانتظار تشغيل فحص المالك على Mac | Not included in Oct 31 export — غير متاح — بانتظار تشغيل فحص المالك على Mac. |
| `stock.quant` | yes (Oct 31 cached sample) | غير متاح — بانتظار تشغيل فحص المالك على Mac (Oct 31 sample: 1,000 rows, 1,000-row cap) | غير متاح — بانتظار تشغيل فحص المالك على Mac | غير متاح — بانتظار تشغيل فحص المالك على Mac | 54.5% internal (545/1000, incl. 70 QRN/Stock rows; full live: غير متاح — بانتظار تشغيل فحص المالك على Mac) | id, product_id, location_id, quantity | Stale Oct 31 sample dropped from all prod paths; live stock.quant value/totalCount: غير متاح — بانتظار تشغيل فحص المالك على Mac. |
| `mrp.bom` | غير متاح — بانتظار تشغيل فحص المالك على Mac | غير متاح — بانتظار تشغيل فحص المالك على Mac | غير متاح — بانتظار تشغيل فحص المالك على Mac | غير متاح — بانتظار تشغيل فحص المالك على Mac | N/A (company recipes) | غير متاح — بانتظار تشغيل فحص المالك على Mac | Not in Oct 31 export — غير متاح — بانتظار تشغيل فحص المالك على Mac. service.ts checks totalCount (not just 30d create_date) so older BoMs are detected. |
| `mrp.bom.line` | غير متاح — بانتظار تشغيل فحص المالك على Mac | غير متاح — بانتظار تشغيل فحص المالك على Mac | غير متاح — بانتظار تشغيل فحص المالك على Mac | غير متاح — بانتظار تشغيل فحص المالك على Mac | N/A (recipe components) | غير متاح — بانتظار تشغيل فحص المالك على Mac | Not in Oct 31 export — غير متاح — بانتظار تشغيل فحص المالك على Mac. |
| `pos.payment` | yes (Nov 17 live sync payload) | غير متاح — بانتظار تشغيل فحص المالك على Mac | غير متاح — بانتظار تشغيل فحص المالك على Mac | Cached daily series: 2026-09-14 → 2026-11-17; full live span: غير متاح — بانتظار تشغيل فحص المالك على Mac | غير متاح — بانتظار تشغيل فحص المالك على Mac | session_id, payment_method_id, amount, payment_date | 5-week (config × hour × method) read_group live row count & coverage: غير متاح — بانتظار تشغيل فحص المالك على Mac; 30 whitelisted registers in pos-registry.json. |

## 2. Owner Action on Mac (Live Read-Only Capture)

When `.env.local` (`ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`, `ODOO_API_KEY`) is present in the repo root on the Mac, run:

```bash
node scripts/probe-odoo-models.mjs
# or run all read-only Phase 1 & Phase 2 Mac probes together:
node scripts/run-mac-readonly-probes.mjs
```

This overwrites `docs/redo/odoo-model-probe.md` and `docs/redo/odoo-model-probe.json` with live read-only counts, date spans, and branch coverage percentages (with automatic secret redaction).

