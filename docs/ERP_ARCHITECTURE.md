# Aether BI ERP: architecture

This is a modular monolith inside the existing Next.js 14 app. It is deployed on Vercel and uses Supabase for authentication and Postgres.

## What is built and what is not

| Module | State |
| --- | --- |
| `finance` | Built: invoices, lines, approval, payments, void, summary. API, UI, migrations, tests. |
| `crm` | Built: customers (with a 360 profile), the opportunity pipeline (Kanban), quotations, and one-click quote-to-cash into finance and inventory. API, UI, migration `0007`, tests. |
| `inventory` | Built: items, warehouses, an append-only stock ledger, balances, reorder alerts, valuation, fast-moving items. API, UI, migration `0006`, tests. Finance deducts and restores stock through its public API. |
| `hr` | Not started. Folder tree below is the plan. |
| `ai` | Not started. Rules for it are in `.cursor/rules/erp-security-events.mdc`. |
| General ledger, credit notes | Not built. You decided: invoices and payments only for now. |

## Folder tree

```
restaurant-ai-hqw/
  database/
    migrations/            0001_core, 0002_crm, 0003_inventory, 0004_finance, 0005_bootstrap, 0006_inventory_ops, 0007_crm_sales
  scripts/migrate.mjs      applies migrations in order, refuses to run a migration that was edited after it was applied
  docs/ERP_ARCHITECTURE.md
  src/
    app/
      api/v1/
        finance/invoices/            GET list, POST create
        finance/invoices/summary/    GET
        finance/invoices/[id]/       GET, PATCH (drafts only)
        finance/invoices/[id]/submit | approve | void | payments   POST
        crm/customers/ , customers/[id]/   GET list or one, POST create, PATCH update
        crm/customers/[id]/profile/  GET customer 360
        crm/leads/ , leads/[id]/ , leads/summary/   GET, POST, PATCH, per-stage totals
        crm/leads/[id]/stage/        POST move between stages
        crm/quotations/ , quotations/[id]/   GET, POST, PATCH (drafts only)
        crm/quotations/[id]/send | accept | reject | expire | convert   POST
        crm/team/                    GET members, for assignment
        inventory/items/ , items/[id]/   GET list or one, POST create, PATCH update
        inventory/warehouses/ , warehouses/[id]/   GET, POST, PATCH
        inventory/movements/         GET ledger, POST IN | OUT | TRANSFER
        inventory/balances/          GET on-hand per item and warehouse
        inventory/summary/           GET valuation, low stock, fast-moving, warehouse usage
      erp/finance/page.tsx           the finance screen (server page, redirects to /login when signed out)
      erp/inventory/page.tsx         the inventory screen (same guard)
      erp/crm/page.tsx               the CRM screen: pipeline, customers, quotations (same guard)
      admin/, login/                 existing product admin and sign-in
    components/
      ui.tsx, charts.tsx             existing shared UI (see "Conflicts with the rules")
      erp/                           FinanceDashboard, InvoiceForm, InvoicePanel, StatusBadge, api.ts, styles.ts, common.tsx (Modal, ListPage, useDebounced)
    lib/
      db.ts logger.ts env.ts money.ts audit.ts sequences.ts idempotency.ts domain-error.ts safe-next.ts
      api/    errors.ts parse.ts cursor.ts keyset.ts route.ts
      auth/   context.ts permissions.ts
      events/ bus.ts
      supabase/                      existing browser/server clients
    modules/
      finance/   domain/ services/ repositories/ events/ api/v1/ schemas/ __tests__/ index.ts client.ts
      crm/       domain/ services/ repositories/ events/ api/v1/ schemas/ __tests__/ index.ts client.ts
      inventory/ domain/ services/ repositories/ events/ api/v1/ schemas/ ui/ __tests__/ index.ts client.ts
      (crm also has ui/: CrmWorkspace, PipelineBoard, CustomerDirectory, CustomerProfile, QuotationList, QuotationBuilder)
      hr/ (planned)  ai/ (planned)
```

Each module has two entry points. `index.ts` is the server API: route handlers, services, types. `client.ts` is browser-safe: types, Zod schemas and pure domain rules, so forms use the same schema as the API without bundling `pg`. Other modules and routes import only from these two files.

## Request flow

`route.ts` → `protectedRoute(permission, handler)` → `authenticate()` → handler parses input with Zod → service → one transaction → repository SQL → audit row → commit → events emitted after commit.

1. `authenticate()` reads the Supabase session, finds the user's tenant in `tenant_members`, loads that role's permissions from `role_permissions`, and requires the route's permission. It reads the tenant from the database, never from the request body. A user with several tenants must send `x-tenant-id`.
2. Every repository query filters by `tenant_id`.
3. Errors become `{ error: { code, message, details? } }`. Unexpected errors are logged and the client only sees `internal_error`.

## Database

All money is `bigint` fils (KWD has three decimals). Tax rates are integer basis points. Timestamps are `timestamptz` and stay in UTC until the UI.

Every tenant table has `tenant_id`, `created_at`, `updated_at`, `created_by`. Two infrastructure tables are exceptions, noted in the migration: `audit_log` is append-only (no `updated_at`) and `idempotency_keys` / `tenant_sequences` are bookkeeping.

Child tables use composite foreign keys `(tenant_id, id)`, so a row can never point at another tenant's parent.

Database-level guards (tested in `invoice-db.test.ts`):

- Invoices, payments and audit rows cannot be deleted. Payments and audit rows cannot be updated.
- After an invoice leaves draft, its number, customer, dates and amounts cannot change, its lines cannot change, a void invoice cannot change, and `paid_minor` cannot go down.
- At commit, an invoice's stored subtotal and tax must equal what its lines produce (a deferred constraint trigger). This repeats the rounding rule in SQL.

### Row level security

RLS is on for every table. The only policies are `select` for the `authenticated` role, limited to the user's tenants and, for finance, CRM and inventory, to users who hold the read permission. There are no insert, update or delete policies, so a browser talking to Supabase directly can read but not write.

The API connects with `DATABASE_URL`. That connection uses the database owner role, which bypasses RLS. Tenant isolation on that path comes from the `tenant_id` filter in every repository query and the membership check in `authenticate()`. RLS protects the other path: direct Supabase client access.

## Finance rules you decided

- Tax is per line (basis points). The unrounded line taxes are summed and rounded half up once per invoice. Example: three lines of 0.003 KWD at 15% give 0.001 KWD of tax, not 0.000.
- An invoice whose total is strictly above 5,000.000 KWD needs approval. At exactly 5,000.000 it does not. The limit lives in `finance_settings.approval_threshold_minor`.
- Statuses: `draft` → `issued` (at or under the limit) or `pending_approval` → `issued` (after approval) → `partially_paid` → `paid`. `void` is final.
- Currency is KWD only.

## Rules I had to choose (change them if they are wrong)

- Rounding mode is half up. You said "round once per invoice", not which way a half goes.
- "Above 5,000 KWD" is read literally as greater than, not greater than or equal.
- A payment larger than the balance is rejected. There is no overpayment or credit.
- An invoice with any payment cannot be voided, because there is no payment reversal or credit note yet.
- A user can approve an invoice they created. Self-approval is not blocked, because you did not set that rule.
- Quantities are whole numbers (1 to 1,000,000). An invoice total must be above zero to submit.
- Invoice numbers are `<prefix>-<6 digits>` from a per-tenant counter. A draft takes its number when created, and numbers are never reused after a void.
- Draft lines are deleted and re-inserted when a draft is edited. That is the only delete in finance, it is blocked once the invoice leaves draft, and the audit row keeps the before and after.
- Payment methods are cash, card, KNET and bank transfer.
- The seeded roles (`owner`, `accountant`, `approver`, `viewer`) and their permissions are in `0005_bootstrap.sql`. Edit `role_permissions` per tenant.

## Inventory

Migration `0006_inventory_ops.sql` extends the `warehouses` and `items` tables from `0003` instead of adding `inventory_items`, so no data model is duplicated. It replaces the unused milli-unit `stock_movements` and `stock_levels` from `0003` (no code used them).

- `items`: SKU, name, unit, `unit_cost_minor`, `selling_price_minor`, `reorder_level`, `current_stock`. `warehouses`: code, name, location, capacity, status.
- `stock_movements` is the ledger and is append-only. `quantity` is signed: IN is positive, OUT is negative, a TRANSFER is two rows (out and in) that share a `reference_id`. Invoice movements carry the invoice id as `reference_id`.
- `stock_balances(item, warehouse, on_hand)` and `items.current_stock` are maintained by the trigger `apply_stock_movement` on insert into the ledger. `on_hand` has a CHECK of at least zero, so stock cannot go negative even under concurrent requests.
- A unique index stops the same invoice writing the same movement twice.
- Quantities are whole numbers, 1 to 1,000,000 per movement. Valuation is `current_stock x unit_cost_minor` over all items, including inactive ones.
- The service locks the affected items in id order before checking shortages, so two invoices that compete for the same stock cannot both pass.

How finance uses it (decisions you made):

- Each invoice line may carry an item and a warehouse (both or neither). A line with neither is a service line.
- Stock is deducted when the invoice becomes `issued`, whether directly on submit or after approval. If any line is short, the whole issue fails with 409 `insufficient_stock` and nothing changes.
- Voiding an issued invoice that has no payments writes reversing IN movements. A second void attempt restores nothing.
- Both the stock writes and the invoice status change run in the same transaction. Inventory events are published after commit.

## CRM and sales

Migration `0007_crm_sales.sql` extends the existing `customers` table and renames `deals` to `crm_leads_pipeline`, instead of adding parallel `crm_customers` tables, because finance already points at `customers`. It adds `sales_quotations` and `sales_quotation_lines` (a quotation line is exactly an invoice line, so conversion copies it without translation). Quotations link to `items`, `warehouses`, `crm_leads_pipeline` and the resulting `invoices`. Every table has `version`, tenant columns and composite tenant foreign keys, with RLS select policies like the other modules. Quote numbers are `QT-000001` from the tenant sequence `crm.quotation`.

Decisions you made:

- Only the Convert button runs quote-to-cash. "Accepted" records the customer's decision and nothing else.
- Conversion creates the invoice and submits it by the normal finance rules: `issued` with stock deducted when the total is at or under the approval limit, otherwise `pending_approval` and stock is deducted on approval. The invoice is due 30 days after the issue date (UTC).
- Each quotation line picks its warehouse.
- Conversion is blocked with 409 `credit_limit_exceeded` when the customer's open balance plus the new invoice total is above their credit limit. A null limit means no limit. Open balance counts issued and partially paid invoices.
- Lead stages `new`, `contacted`, `qualified`, `proposal` move freely. `won` and `lost` are final.
- A quotation for a `lead` or `prospect` customer cannot be converted (409 `customer_not_active`). Activate the customer first. Nothing changes the status behind your back. The old `inactive` status became `blocked`.

One transaction does all of it (`conversion-service.ts`): lock the quotation and the customer, check shortages, check credit, create and submit the invoice through finance's `createInvoiceWithin` / `submitInvoiceWithin` (which call inventory's stock functions), mark the quotation converted, set an open lead to won, write audit rows. Events go out after commit. A replay with the same `Idempotency-Key` returns the first result. A failure at any step, including a late one, leaves no invoice, no stock movement, no lead change and no audit row (tested with an injected trigger failure).

Rules I had to choose (change them if they are wrong):

- Quotation statuses: `draft` → `sent` → `accepted` | `rejected` | `expired`; `accepted` → `converted`. `rejected`, `expired` and `converted` are final. Only drafts are editable.
- There is no scheduler. A sent quotation past `valid_until` is shown as expired, cannot be accepted (409 `quote_expired`), and can be marked expired. `valid_until` governs acceptance only, not conversion of an already accepted quotation.
- Tax rate is per quotation line. There is no per-line total with tax because tax is rounded once per document.
- Nothing is hard-deleted. Customers become `blocked`, leads become `lost`, quotations become rejected or expired. "Full CRUD" is create, read, update and these state changes.
- Lead probability is typed by the user (0 to 100), forced to 100 on won and 0 on lost. Closed leads are read-only. A quotation can link only to an open lead. At conversion an open lead becomes won, a lost lead is left as it is.
- Conversion needs `crm.quotation.convert` plus `finance.invoice.create` and `finance.invoice.submit`. Stock shortages on a quotation need `inventory.stock.read`. The customer's money figures need `finance.invoice.read`.
- New permissions: `crm.customer.update`, `crm.lead.read|create|update`, `crm.quotation.read|create|update|accept|convert`. `owner` and `accountant` get all of them, `approver` and `viewer` get read only. Existing tenants are backfilled by the migration.
- There is no outbox table. You have no queue yet, so conversion writes audit rows and publishes events after commit, like the other modules.
- Customer create defaults to `active`, so the inline "new customer" in the invoice form keeps working. The invoice form lists active customers only.
- Arabic strings are new text I wrote. Have a native reviewer read them.

## Events

In-process emitter in `src/lib/events/bus.ts`. Names follow `<module>.<entity>.<past-tense-verb>` and carry a version. Finance emits `created`, `updated`, `submitted`, `approved`, `issued`, `voided`, `paid` for invoices and `finance.payment.recorded`. CRM emits `crm.customer.created` / `updated`, `crm.lead.created` / `updated` / `moved` / `won` / `lost` and `crm.quotation.created` / `updated` / `status_changed` / `converted`. Inventory emits `inventory.stock.moved`, `inventory.stock.depleted`, `inventory.item.reorder_level_reached` (once per downward crossing of the level), `inventory.item.created` / `updated` and `inventory.warehouse.created` / `updated`. Reorder alerts are events and the overview list. There is no notification channel yet, so nothing e-mails or pushes.

Events are emitted after the transaction commits. A replayed idempotent request emits nothing. A failing handler is logged and never reaches the emitter.

Limit: on Vercel an in-process emitter only reaches handlers in the same function invocation, and nothing is retried if the process stops after the commit. When you need reliable delivery, add an outbox table and a queue. I did not add one because the rules say to wait until a queue is chosen.

## Setup

1. Create a Supabase project. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL` (transaction pooler string) and `DATABASE_SSL` in `.env.local` and in Vercel. See `.env.example`.
2. `npm run db:migrate`
3. Create a user in Supabase Authentication, then in the SQL editor: `select erp_bootstrap_tenant('Your company', 'your-slug', '<that user id>');`
4. Sign in at `/login` and open `/erp/finance`, `/erp/inventory` or `/erp/crm`. Tenants created before `0006` get the new inventory permissions from the migration's backfill.

## Tests

`npm test` runs about 300 tests. The integration test applies the real migrations to an in-process Postgres (PGlite) and runs the real repositories and services against it. PGlite is not Supabase, so it does not test RLS policies, the `authenticate()` lookup, or the pooled connection.

## Conflicts with the rules

- The rules say shared UI lives in `src/components/ui/`. The repo has a single file `src/components/ui.tsx`. I followed the repo and left it. ERP components are in `src/components/erp/`.
- The rules say a module exports only from `index.ts`. Modules here also have `client.ts` so the browser never imports server code. This is a technical need, not a business rule.
- `database/schema/` is unused. All schema is in migrations.
- `crm` and `finance` import each other: finance calls `findCustomer` from `@/modules/crm`, and CRM calls finance's `createInvoiceWithin`, `submitInvoiceWithin` and `getCustomerFinancials` for conversion and the 360 profile. Both go through public entry points only and it works at runtime (tests prove it), but it is a cycle. If you want it gone, move the conversion into a separate orchestration module.
- The brief names `crm_customers`, `sales_quotations` and `inventory_items`. The repo's `customers` and `items` are extended instead, and `deals` became `crm_leads_pipeline`.
- The brief asks for audit triggers. Audit rows here are written by the services inside the same transaction, like finance and inventory, and `audit_log` itself is append-only in the database. No separate audit trigger was added.
- The brief says CRM UI lives in `/src/modules/crm/` and `/app/erp/crm/`. The page is in `src/app/erp/crm/`, the screens in `src/modules/crm/ui/`.
- The brief names a table `inventory_items`. The repo already had `items`, so `0006` extends it.
- Inventory screens live in `src/modules/inventory/ui/` as the brief asked. The ERP rules put shared UI in `src/components/`, and finance screens are in `src/components/erp/`. Both stay as they are.

## Inventory limits

- Warehouse capacity is shown, not enforced. Nothing blocks a movement that exceeds it.
- SKU, unit and warehouse code cannot change after creation.
- An inactive item or warehouse can lose stock but not receive it or be sold.
- "Fast-moving" counts OUT movements only (sales and write-offs), not transfers.
- The invoice form and stock form list the first 100 items and customers. Past that you need a search box, which is not built.
- PGlite does not test the inventory RLS policies. Check them once on a real Supabase project.

## What this does not claim

The brief asks for something that "outperforms Odoo". I cannot guarantee that. What is here is a small, tested finance slice with keyset pagination, indexes for the list sorts, and database-enforced integrity. Measure it against your own data before comparing.
