# Review round 2 — logical, realistic, accurate

Local production build, offline env, real Odoo payloads only (17 Nov 2026 06:05 sync for sales;
31 Oct 2026 stock export for the warehouse). "Before" = the same build before the audit fixes;
"after" = this commit. Production (aetherbi.com) does not include these changes until deployed.

| Image | What changed |
|---|---|
| `warehouse-chain.png` | No product cost in Odoo → KWD shows «—» with a note, never 0.000 beside real quantities; branches without movement show «—» and «لا حركة مسجلة» instead of «Normal»; RTL table columns aligned and padded |
| `home-today.png` | "So far · until 06:00"; branches with no sales yet listed on one line instead of 0.000 cards; 7-day pulse uses the real daily rows when the payload has no week bucket |
| `cores-today-after.png` | Brand total reconciled to POS net (gap shown); zero-sale brands/channels listed by name |
| `inventory.png`, `stock-count.png` | Cost 0 = not recorded → «—», not 0.000 KWD |
| `hr-directory.png` | No salary on file → «—», not a 0.000 KWD contract |
| `bi-analytics.png` | No invoices → no invented 0% growth / margin; no cash accounts → no cash projection |
| `delivery-control.png` | Unlinked legacy filter bar («All 0 locations», 0.000 slice) removed |
