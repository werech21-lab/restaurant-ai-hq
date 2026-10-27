import { NextResponse } from 'next/server'
import { parseBody, parseParams, parseQuery } from '@/lib/api/parse'
import type { RouteArgs } from '@/lib/api/route'
import { requireIdempotencyKey } from '@/lib/idempotency'
import {
  closePeriod,
  createAccount,
  createJournalEntry,
  createPeriod,
  getAccount,
  getJournalEntry,
  getTrialBalance,
  listAccounts,
  listJournalEntries,
  listPeriods,
  postJournalEntry,
  reverseJournalEntry,
  updateAccount,
  updateJournalEntry,
} from '@/modules/finance/services/ledger-service'
import {
  closePeriodSchema,
  createAccountSchema,
  createJournalEntrySchema,
  createPeriodSchema,
  ledgerIdParamsSchema,
  listAccountsQuerySchema,
  listJournalEntriesQuerySchema,
  listPeriodsQuerySchema,
  postJournalEntrySchema,
  reverseJournalEntrySchema,
  trialBalanceQuerySchema,
  updateAccountSchema,
  updateJournalEntrySchema,
} from '@/modules/finance/schemas/ledger'

// ---- accounts ----

export async function listAccountsHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await listAccounts(auth, parseQuery(request, listAccountsQuerySchema)))
}

export async function createAccountHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await createAccount(auth, await parseBody(request, createAccountSchema)), { status: 201 })
}

export async function getAccountHandler({ auth, params }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await getAccount(auth, parseParams(params, ledgerIdParamsSchema).id))
}

export async function updateAccountHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, ledgerIdParamsSchema)
  return NextResponse.json(await updateAccount(auth, id, await parseBody(request, updateAccountSchema)))
}

// ---- fiscal periods ----

export async function listPeriodsHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await listPeriods(auth, parseQuery(request, listPeriodsQuerySchema)))
}

export async function createPeriodHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await createPeriod(auth, await parseBody(request, createPeriodSchema)), { status: 201 })
}

export async function closePeriodHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, ledgerIdParamsSchema)
  return NextResponse.json(await closePeriod(auth, id, await parseBody(request, closePeriodSchema)))
}

// ---- journal entries ----

export async function listJournalEntriesHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await listJournalEntries(auth, parseQuery(request, listJournalEntriesQuerySchema)))
}

export async function createJournalEntryHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  const key = requireIdempotencyKey(request)
  const outcome = await createJournalEntry(auth, key, await parseBody(request, createJournalEntrySchema))
  return NextResponse.json(outcome.body, { status: outcome.status, headers: outcome.replayed ? { 'Idempotent-Replayed': 'true' } : undefined })
}

export async function getJournalEntryHandler({ auth, params }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await getJournalEntry(auth, parseParams(params, ledgerIdParamsSchema).id))
}

export async function updateJournalEntryHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, ledgerIdParamsSchema)
  return NextResponse.json(await updateJournalEntry(auth, id, await parseBody(request, updateJournalEntrySchema)))
}

export async function postJournalEntryHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, ledgerIdParamsSchema)
  return NextResponse.json(await postJournalEntry(auth, id, await parseBody(request, postJournalEntrySchema)))
}

export async function reverseJournalEntryHandler({ request, auth, params }: RouteArgs): Promise<NextResponse> {
  const { id } = parseParams(params, ledgerIdParamsSchema)
  const key = requireIdempotencyKey(request)
  const outcome = await reverseJournalEntry(auth, id, key, await parseBody(request, reverseJournalEntrySchema))
  return NextResponse.json(outcome.body, { status: outcome.status, headers: outcome.replayed ? { 'Idempotent-Replayed': 'true' } : undefined })
}

// ---- reports ----

export async function trialBalanceHandler({ request, auth }: RouteArgs): Promise<NextResponse> {
  return NextResponse.json(await getTrialBalance(auth, parseQuery(request, trialBalanceQuerySchema)))
}
