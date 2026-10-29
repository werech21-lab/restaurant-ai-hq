import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { routeArchive } from '@/lib/governance-routing'
import { bootstrapTenant, createUser, getPglite, startDatabase, stopDatabase } from '@/lib/__tests__/support/database'
import type { AuthContext } from '@/lib/auth/context'
import { allPermissions } from '@/lib/auth/permissions'
import { DomainError } from '@/lib/domain-error'
import { createPartner, createOrder } from '@/modules/delivery'
import { actOnEscalation, aggregatorBoard, analyzeContractFor, listBlocks, actOnTask, actOnViolation, openInquiry, raiseAlert, registerViolation, scanAggregator } from '@/modules/governance'
import { CLOSE_BLOCKED_MESSAGE } from '@/modules/governance/domain/desk'
import { createAttendance, createEmployee, createExpense } from '@/modules/hr'
import { createContract } from '@/modules/operations'

vi.mock('@/lib/db', async () => {
  const support = await import('@/lib/__tests__/support/database')
  return { db: support.testDb, withTransaction: support.testWithTransaction }
})

const pg = () => getPglite()
let key = 0
const nextKey = () => `gov-key-${String(++key).padStart(6, '0')}`
let auth: AuthContext

beforeAll(async () => {
  await startDatabase()
  const owner = randomUUID()
  await createUser(owner)
  auth = { userId: owner, tenantId: await bootstrapTenant('Governance', 'gov-co', owner), permissions: new Set(allPermissions) }
}, 120_000)
afterAll(stopDatabase)

async function rule(code: string, type: string, threshold: number, authority: string, department: string): Promise<void> {
  const circular = randomUUID()
  await pg().query(
    `insert into regulatory_circulars (id, tenant_id, authority_name, regulation_code, title_ar, target_department, ai_recommendation_ar, status, created_by)
     values ($1, $2, $3, $4, $4, $5, 'إيقاف', 'enforced', $6)`,
    [circular, auth.tenantId, authority, code, department, auth.userId],
  )
  await pg().query(
    `insert into compliance_enforcement_rules (tenant_id, circular_id, rule_code, rule_type, threshold_value, is_active, created_by)
     values ($1, $2, $3, $4, $5, true, $6)`,
    [auth.tenantId, circular, code, type, threshold, auth.userId],
  )
}

describe('governance on the live schema', () => {
  it('creates the 0025 tables', async () => {
    for (const name of ['contract_ai_analyses', 'regulatory_circulars', 'compliance_enforcement_rules', 'compliance_blocked_attempts', 'ai_learning_memory', 'smart_archive_documents', 'employee_behavior_telemetry', 'competitive_intelligence_radar']) {
      const found = await pg().query<{ name: string | null }>('select to_regclass($1) as name', [`public.${name}`])
      expect(found.rows[0].name).toBe(name)
    }
  })

  it('stops a cash expense above the ceiling and keeps the block after the expense is refused', async () => {
    await rule('CIRC-KW-2026-03', 'cash_ceiling_kwd', 50_000, 'وزارة التجارة', 'المالية')
    const employee = await createEmployee(auth, nextKey(), {
      employeeCode: 'EMP-G', fullName: 'خالد', roleTitle: 'أمين', department: 'المالية', branchId: null,
      basicSalaryMinor: 1000, allowancesMinor: 0, residencyExpiry: null, status: 'active',
    })
    const attempt = createExpense(auth, nextKey(), { employeeId: employee.body.data.id, category: 'نقد', amountMinor: 80_000, cash: true })
    await expect(attempt).rejects.toBeInstanceOf(DomainError)
    await expect(attempt).rejects.toThrow('تم إيقاف الإجراء لمخالفته التعميم الرقابي المعتمد رقم [CIRC-KW-2026-03]')
    const expenses = await pg().query<{ count: number }>('select count(*)::int as count from hr_expenses where tenant_id = $1', [auth.tenantId])
    expect(expenses.rows[0].count).toBe(0)
    const blocks = await listBlocks(auth)
    expect(blocks[0]?.blockMessageAr).toBe('تم إيقاف الإجراء لمخالفته التعميم الرقابي المعتمد رقم [CIRC-KW-2026-03]')
    const audit = await pg().query<{ description_ar: string }>(
      `select description_ar from audit_activity_logs where tenant_id = $1 and module = 'governance' and action_type = 'blocked'`,
      [auth.tenantId],
    )
    expect(audit.rows.map((row) => row.description_ar)).toContain('تم إيقاف الإجراء لمخالفته التعميم الرقابي المعتمد رقم [CIRC-KW-2026-03]')
    const allowed = await createExpense(auth, nextKey(), { employeeId: employee.body.data.id, category: 'نقد', amountMinor: 15_000, cash: true })
    expect(allowed.body.data.id).toBeTruthy()
  })

  it('stops an over-long shift and an expired driver license', async () => {
    await rule('CIRC-KW-2026-02', 'max_working_hours', 8, 'القوى العاملة', 'الموارد البشرية')
    await rule('CIRC-KW-2026-01', 'expired_driver_license', 0, 'المرور والنقل', 'الأسطول')
    const employee = await createEmployee(auth, nextKey(), {
      employeeCode: 'EMP-H', fullName: 'سارة', roleTitle: 'مشرفة', department: 'التشغيل', branchId: null,
      basicSalaryMinor: 1000, allowancesMinor: 0, residencyExpiry: null, status: 'active',
    })
    await expect(createAttendance(auth, nextKey(), {
      employeeId: employee.body.data.id, branchId: null, checkIn: '2026-10-29T06:00:00.000Z', checkOut: '2026-10-29T15:01:00.000Z', overtimeMinutes: 0,
    })).rejects.toThrow('تم إيقاف الإجراء لمخالفته التعميم الرقابي المعتمد رقم [CIRC-KW-2026-02]')
    const kept = await createAttendance(auth, nextKey(), {
      employeeId: employee.body.data.id, branchId: null, checkIn: '2026-10-29T06:00:00.000Z', checkOut: '2026-10-29T10:00:00.000Z', overtimeMinutes: 0,
    })
    expect(kept.status).toBe(201)
    const partner = await createPartner(auth, nextKey(), { code: 'FAST', name: 'النقل', commissionBps: 0 })
    await expect(createOrder(auth, nextKey(), {
      partnerId: partner.body.data.id, orderedOn: '2026-10-29', grossMinor: 1000, commissionMinor: 0, driverLicenseExpiry: '2020-01-01',
    })).rejects.toThrow('تم إيقاف الإجراء لمخالفته التعميم الرقابي المعتمد رقم [CIRC-KW-2026-01]')
    const order = await createOrder(auth, nextKey(), {
      partnerId: partner.body.data.id, orderedOn: '2026-10-29', grossMinor: 1000, commissionMinor: 0, driverLicenseExpiry: '2999-01-01',
    })
    expect(order.status).toBe(201)
  })

  it('stores a contract analysis and routes an archived contract into the contracts module', async () => {
    const contract = await createContract(auth, nextKey(), {
      title: 'عقد صيانة', counterparty: 'ورشة الأفق', startDate: '2026-01-01', endDate: '2099-01-01', valueMinor: 1000, renewalAlertDays: 30, status: 'active',
    })
    const analysis = await analyzeContractFor(auth, nextKey(), { contractId: contract.body.data.id })
    expect(analysis.body.data.riskScore).toBe(25)
    expect(analysis.body.data.clausesSummaryAr).toContain('ورشة الأفق')
    const request = new NextRequest('http://localhost/api/v1/governance/archive', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': nextKey() },
      body: JSON.stringify({ fileName: 'عقد-جديد.pdf', documentCategory: 'contract', text: 'الطرف: مؤسسة الخليج\nالقيمة 2400.000 د.ك' }),
    })
    const response = await routeArchive({ request, auth, params: {} })
    expect(response.status).toBe(201)
    const body = await response.json() as { data: { status: string; routedToModule: string; routedRecordId: string | null; amountMinor: number } }
    expect(body.data.status).toBe('routed')
    expect(body.data.routedToModule).toBe('/erp/contracts')
    expect(body.data.amountMinor).toBe(2_400_000)
    expect(body.data.routedRecordId).toBeTruthy()
  })

  it('refuses to verify a government violation without a statement and a closure proof', async () => {
    const opened = await registerViolation(auth, nextKey(), {
      violationNumber: 'KW-TEST-0001',
      issuingAuthority: 'بلدية الكويت',
      branchId: null,
      violationTypeAr: 'لوحة دون ترخيص',
      fineAmountMinor: 150_000,
      assignedEmployeeName: 'فهد العازمي',
      slaDeadline: '2026-11-02',
    })
    await expect(actOnViolation(auth, opened.body.data.id, { action: 'close', version: opened.body.data.version })).rejects.toThrow(CLOSE_BLOCKED_MESSAGE)
    const stage = await pg().query<{ workflow_stage: string }>('select workflow_stage from gov_violations_tracker where id = $1', [opened.body.data.id])
    expect(stage.rows[0].workflow_stage).toBe('assigned')
    await expect(pg().query(`update gov_violations_tracker set workflow_stage = 'closed_verified' where id = $1`, [opened.body.data.id])).rejects.toThrow(/gov_violations_close_requires_proof/)
  })

  it('opens an investigation and dispatches an executive task', async () => {
    const inquiry = await openInquiry(auth, nextKey(), {
      caseNumber: 'INV-TEST-0001',
      sourceType: 'manager_referral',
      sourceReferenceId: null,
      subjectEmployeeName: 'يوسف الشمري',
      investigatorName: 'لجنة التقصي الداخلية',
      incidentSummaryAr: 'إحالة لفحص تكرار الملاحظة.',
      evidenceRef: null,
    })
    expect(inquiry.body.data.status).toBe('open_summons')
    const alert = await raiseAlert(auth, nextKey(), { alertCategory: 'employee_neglect', severity: 'critical', titleAr: 'إهمال محضر تجريبي' })
    const dispatched = await actOnTask(auth, alert.body.data.id, {
      action: 'dispatch',
      version: alert.body.data.version,
      assignedToEmployee: 'فهد العازمي',
      taskInstructionAr: 'ارفع إثبات الإغلاق اليوم.',
      dueDate: '2026-11-05',
    })
    expect(dispatched.data.status).toBe('task_dispatched')
    expect(dispatched.data.assignedToEmployee).toBe('فهد العازمي')
  })

  it('records a five-minute rank, the fleet mode, the top-rank gap, and an approved escalation', async () => {
    const found = await pg().query<{ name: string | null }>('select to_regclass($1) as name', ['public.aggregator_geo_rank_snapshots'])
    expect(found.rows[0].name).toBe('aggregator_geo_rank_snapshots')
    const snapshot = await pg().query<{ id: string }>(
      `insert into aggregator_geo_rank_snapshots (
        tenant_id, snapshot_interval_time, platform_name, geo_zone_ar, our_brand_name, our_branch_name,
        current_rank, previous_rank_5m_ago, rank_delta, overall_rating_bps, reviews_count,
        estimated_visits_impressions, conversion_rate_bps, delivery_eta_minutes, delivery_fee_minor,
        min_order_minor, logistics_mode, is_sponsored_ad_active, created_by
      ) values (
        $1, '2026-10-29T06:00:00Z', 'Keeta', 'السالمية', 'مجموعة أثير', 'أثير السالمية',
        8, 9, 1, 420, 860, 4200, 850, 28, 750, 3000, 'vendor_own_fleet', false, $2
      ) returning id`,
      [auth.tenantId, auth.userId],
    )
    const snapshotId = snapshot.rows[0].id
    await pg().query(
      `insert into aggregator_top_competitors_bench (
        tenant_id, snapshot_id, platform_name, geo_zone_ar, competitor_rank, competitor_brand_name,
        competitor_rating_bps, competitor_reviews_count, competitor_visits_estimate, competitor_eta_minutes,
        competitor_delivery_fee_minor, competitor_logistics_mode, active_promo_badge_ar,
        detected_rating_boost_policy_ar, gap_vs_our_brand_json, created_by
      ) values (
        $1, $2, 'Keeta', 'السالمية', 1, 'فريش برجر', 470, 2100, 9000, 22, 0, 'platform_fleet', 'توصيل مجاني',
        'أسطول التطبيق مع وقت تحضير أقل من 12 دقيقة.',
        '{"rankGap":7,"etaGapMinutes":6,"feeGapMinor":750,"ratingGapBps":50}'::jsonb, $3
      )`,
      [auth.tenantId, snapshotId, auth.userId],
    )
    const action = await pg().query<{ id: string }>(
      `insert into aggregator_rank_escalation_actions (
        tenant_id, platform_name, geo_zone_ar, our_branch_name, current_rank, target_rank,
        root_cause_of_lower_rank_ar, algorithmic_recommendation_ar, recommended_action_type,
        estimated_rank_jump, estimated_revenue_uplift_minor, created_by
      ) values (
        $1, 'Keeta', 'السالمية', 'أثير السالمية', 8, 2,
        'التوصيل على أسطول الشركة.', 'تحويل التوصيل إلى أسطول التطبيق.', 'switch_fleet_mode', 6, 450000, $2
      ) returning id`,
      [auth.tenantId, auth.userId],
    )
    const board = await aggregatorBoard(auth, { platform: 'Keeta', zone: 'السالمية' })
    const row = board.snapshots.find((item) => item.id === snapshotId)
    expect(row?.currentRank).toBe(8)
    expect(row?.rankDelta).toBe(1)
    expect(row?.logisticsMode).toBe('vendor_own_fleet')
    expect(row?.deliveryFeeMinor).toBe(750)
    expect(row?.algorithmPenaltyReasonAr).toBeNull()
    expect(row?.avgOrderAcceptanceSeconds).toBe(0)
    expect(board.competitors[0]?.gap).toEqual({ rankGap: 7, etaGapMinutes: 6, feeGapMinor: 750, ratingGapBps: 50 })
    expect(board.competitors[0]?.competitorLogisticsMode).toBe('platform_fleet')
    const approved = await actOnEscalation(auth, action.rows[0].id, { action: 'execute', version: 1 })
    expect(approved.data.status).toBe('approved_executing')
    const audit = await pg().query<{ description_ar: string }>(
      `select description_ar from audit_activity_logs where tenant_id = $1 and entity_type = 'aggregator_escalation'`,
      [auth.tenantId],
    )
    expect(audit.rows[0]?.description_ar).toContain('أثير السالمية')
    const scanned = await scanAggregator(auth, nextKey(), {})
    expect(scanned.body.data.recorded).toBe(1)
    const rolled = await pg().query<{ rank_delta: number; logistics_mode: string }>(
      `select rank_delta, logistics_mode from aggregator_geo_rank_snapshots
       where tenant_id = $1 and snapshot_interval_time > '2026-10-29T06:00:00Z'`,
      [auth.tenantId],
    )
    expect(rolled.rows[0]?.rank_delta).toBe(0)
    expect(rolled.rows[0]?.logistics_mode).toBe('vendor_own_fleet')
    await expect(pg().query(`update aggregator_geo_rank_snapshots set logistics_mode = 'courier' where id = $1`, [snapshotId])).rejects.toThrow(/logistics_mode/)
    await expect(pg().query(`update aggregator_geo_rank_snapshots set rank_delta = 9 where id = $1`, [snapshotId])).rejects.toThrow(/aggregator_geo_rank_delta_check/)
    await expect(pg().query(
      `update aggregator_geo_rank_snapshots set current_rank = 46, previous_rank_5m_ago = 48, rank_delta = 2 where id = $1`,
      [snapshotId],
    )).rejects.toThrow(/aggregator_geo_rank_penalty_check/)
  })
})
