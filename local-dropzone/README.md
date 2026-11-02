# Local Dropzone — Direct DB Ingest

Drop any mixed files or folders here on this PC, then run:

```bat
Direct-DB-Ingest.bat
```

or:

```bash
npm run ingest:direct
```

The CLI parses Excel / Word / PDF / CSV / text **locally**, classifies into the 7 ERP departments, and upserts **extracted records + index** into the database (SHA-256 idempotent). Default mode uploads **no binaries** (near-zero internet).

Optional binary store: `npm run ingest:direct -- --upload-binaries`

Pass any Windows path:

```bash
npx tsx scripts/direct-db-ingest.ts "C:\Users\%USERNAME%\Desktop"
```

Scan Desktop/Documents work folders:

```bash
npm run ingest:desktop
```
