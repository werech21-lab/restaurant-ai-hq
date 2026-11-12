# Venture Foods — Aether BI Autonomous Multi-Workstation Protocol (`PC #1 <-> PC #2`)

This repository supports parallel autonomous development across two workstations:
- **PC #1:** Primary Workstation
- **PC #2:** Secondary Workstation (`C:\dev\aether-bi` — strictly outside OneDrive to prevent `.next` / SQLite file-lock corruption)

---

## Mandatory Parallel Anti-Conflict Rules

### Rule 1 — Pre-Task Sync (Before Every Prompt)
Before inspecting files, editing code, or starting **any** new prompt on either PC, **always** synchronize with `origin/main` first:

```bash
git fetch origin main --prune && git pull --rebase origin main
```

This guarantees any commit just landed by the other workstation is rebased cleanly before work begins.

### Rule 2 — Pre-Push Verification & Rebase Pipeline
Never push untested or un-rebased commits to `origin/main`. Right before pushing, **always** run the full deterministic pipeline (or run `npm run safe-push -- "type(scope): summary"`):

1. `node scripts/verify-brain-integrity.mjs` (`0.000 KWD` reconciliation & invariant check)
2. `npx tsc --noEmit` (`Exit Code: 0`)
3. `npm run build` (`Exit Code: 0`)
4. `git add -A` & `git commit -m "..."`
5. `git pull --rebase origin main`
6. `git push origin main`

### Rule 3 — Zero Secret Leak Gate
- `.env.local`, `.env.staging`, and `.env.production` must **never** be tracked or staged in Git.
- Never commit raw provider API key prefixes (modern Google `AQ . Ab8*`, Anthropic `sk - ant*` or plain Base64 `c2st + YW50*`, xAI `xai - *`, or legacy `AI + za*`) anywhere in tracked files.
- Runtime vaults in `src/lib/ai-keys.ts` must preserve split/reversed/XOR runtime decoding with zero raw prefixes.
- `scripts/parallel-sync-push.mjs` and `scripts/verify-brain-integrity.mjs` automatically scan tracked files via `git grep` and block pushes on any match.

---

## Context & Performance Guardrails

- **Never** read `src/lib/full-journey-enterprise-brain.ts` end-to-end (large dataset/brain file; use targeted line ranges or `grep` only if ever inspecting symbols).
- **Never** run builds or worktrees inside `OneDrive` on PC #2 — always execute from `C:\dev\aether-bi`.
