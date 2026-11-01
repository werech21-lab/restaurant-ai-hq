# Odoo eternal dumps — Venture Foods

Source host: `https://venturefoods.walnutss.com` (company id `1`).

- `venturefoods_odoo_cids1_dump.json` — latest full dump (browser console or live extractor).
- `venturefoods-live-*.json` — timestamped live JSON-RPC pulls.

Import into SQLite POS catalog:

```bash
node scripts/import-odoo-dump-to-sqlite.mjs
```

Live UI: `/settings/odoo-sync`
