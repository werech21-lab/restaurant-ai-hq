/**
 * Full-journey Odoo extraction (7 stages + Odoo 17 Analytic Cost Centers) used by scripts/sync-odoo-live.mjs.
 *
 *   1. Procurement, vendors & packaging   purchase.order(.line), product.product categ_id, account.move (vendor bills)
 *   2. Central kitchen, yield & shrinkage  stock.move (CK → branch transit, branch → scrap), posted food / variance / scrap
 *   3. Menu power & basket architecture    pos.order + pos.order.line + pos.payment (order-level baskets per brand)
 *   4. Field operations & discipline       pos.session (late open / early close / cash variance), discounts, hourly curves
 *   5. Hidden opex, custodies, maintenance account.analytic.plan, account.analytic.account, account.analytic.line (3 windows),
 *                                          analytic_distribution unallocated audit, petty-cash & custody balances
 *   6. Aggregator net economics            clearing & receivable accounts, posted platform commissions
 *   7. Quality radar & retention           cancelled orders by dish / shift, complimentary meals, repeat customers
 *
 * Privacy & scope rules
 *   - Only whitelisted pos.config registers (src/lib/odoo/pos-registry.json) are read for POS data.
 *   - Stock locations, journals and analytic accounts are mapped ONLY to whitelisted Venture Foods brands,
 *     the 7 restaurant locations, EXB seasonal booths, school canteens and shared centers (Ardiya Central Kitchen,
 *     Head Office, Call Center); excluded legacy locations are stripped completely.
 *   - No vendor, employee, customer or custodian names are stored (partner ids are counted, never written).
 *   - Every Odoo call runs inside `safe()`; a missing permission is recorded and the stage degrades gracefully.
 */

const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000
const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10
const pct = (a, b) => (b ? r1((a / b) * 100) : 0)
const m2oId = (v) => (Array.isArray(v) ? v[0] : null)
const m2oName = (v) => (Array.isArray(v) ? v[1] : null)
const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out }
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const kuwait = (utc) => new Date(new Date(`${String(utc).replace(' ', 'T')}Z`).getTime() + 3 * 3600 * 1000)
const kuwaitMinutes = (utc) => { const k = kuwait(utc); return k.getUTCHours() * 60 + k.getUTCMinutes() }
const codeOf = (name) => String(name || '').match(/^\[([^\]]+)\]/)?.[1] ?? null
const cleanName = (name) => String(name || '').replace(/^\[[^\]]+\]\s*/, '').trim()

/** Sanitizes any general-ledger account label so excluded legacy location strings can never leak into snapshots. */
const BANNED_LOC_RE = /qurain|jahra|القرين|الجهراء/gi
const safeAccountLabel = (raw) => String(raw || '').replace(/^\d+\s+/, '').replace(BANNED_LOC_RE, '').replace(/\s{2,}/g, ' ').trim()

/** Whitelisted restaurant locations + the Ardiya central kitchen (stock / journal / account name matching). */
const LOC_PATTERNS = {
  promenade: /promenade|^PRM\/|بروميناد/i,
  '360-mall': /(^|[^0-9])360([^0-9]|$)/,
  ardiya: /ardiya (branch|temp)|^ARDB\/|^ARTMP\/|العارضيه|العارضية/i,
  assima: /assima|^ASM\/|العاصمة/i,
  salmiya: /salmiya|^SMIA\/|السالمية/i,
  'al-kout': /kout|^KOUT\/|الكوت/i,
  avenues: /avenue|avenus|^Avns\/|الأفنيوز|الأفينوز/i,
}
const CK_PATTERN = /^CK\/|central kitchen|المطبخ المركزي/i
const EXB_PATTERN = /exhibition|^EXB\//i
const locationOfName = (name) => Object.entries(LOC_PATTERNS).find(([, re]) => re.test(name || ''))?.[0] ?? null

const SHIFT_OF_HOUR = (h) => (h >= 6 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : h >= 17 && h < 22 ? 'evening' : 'late')
const SHIFTS = ['morning', 'afternoon', 'evening', 'late']

/** Expense-category taxonomy (account code + name); rule order matters (`it-systems` precedes `maintenance`). */
const OPEX_RULES = [
  ['raw-food', (c, n) => c === '40001' || /raw food|مواد غذائية/i.test(n)],
  ['inventory-variance', (c, n) => c === '400000' || c === '400008' || /فروقات جردية|مسحوبات مخزون|inventory (count )?difference|shrinkage/i.test(n)],
  ['scrap', (c, n) => c === '420001' || /cost of scrap|هالك/i.test(n)],
  ['packaging', (c, n) => c === '40003' || /packaging|تغليف/i.test(n)],
  ['allowance-discount', (c, n) => /allowance discount|خصم مسموح/i.test(n)],
  ['staff-housing', (c, n) => /accommodation|سكن/i.test(n)],
  ['bank-fees', (c, n) => /bank commission|عمولة بنكية/i.test(n)],
  ['platform-commission', (c, n) => /commission|عمولة/i.test(n)],
  ['platform-subscription', (c, n) => /talabat contract|deliveroo contract|bibayt contract|عقود شركة|عقد شركة/i.test(n)],
  ['rent', (c, n) => /rent|ايجار|إيجار/i.test(n)],
  ['it-systems', (c, n) => /odoo|internet|server|software|برامج|computer|كمبيوتر|network|شبكات/i.test(n)],
  ['maintenance', (c, n) => /maint|repair|صيان|تصليح|installation|workmanship/i.test(n)],
  ['cleaning', (c, n) => /clean|نظاف|hood/i.test(n)],
  ['utilities', (c, n) => /electric|water|كهرباء|مياه|gas cylinder|غاز/i.test(n)],
  ['marketing', (c, n) => /advertis|دعاي|marketing|campaign|promotion/i.test(n)],
  ['staff-costs', (c, n) => /employee|residency|اقام|إقام|health|insurance|clothes|ticket|تذاكر|salar|رواتب|vacation|اجازات|indemnity|نهايه الخدمة|bonus/i.test(n)],
  ['professional-fees', (c, n) => /lawyer|audit|consult|محاما|تدقيق|license|ترخيص|endorsement|تصديق|government|حكوم|fee|رسوم/i.test(n)],
  ['kitchen-supplies', (c, n) => /kitchen supplies|ادوات|أدوات|stationery|قرطاس|consumable|مستهلك/i.test(n)],
]
export const OPEX_CATEGORY_LABELS = {
  'raw-food': ['Raw food cost (40001)', 'تكلفة المواد الغذائية (40001)'],
  'inventory-variance': ['Inventory count variance (400000)', 'فروقات الجرد ومسحوبات المخزون (400000)'],
  scrap: ['Recorded scrap (420001)', 'تكلفة الهالك المسجل (420001)'],
  packaging: ['Packaging items', 'مواد التغليف'],
  'allowance-discount': ['Allowance discounts (53002)', 'الخصم المسموح به (53002)'],
  'staff-housing': ['Branch staff housing', 'سكن موظفي الفروع'],
  'bank-fees': ['Bank & card fees', 'العمولات البنكية'],
  'platform-commission': ['Delivery platform commissions', 'عمولات منصات التوصيل'],
  'platform-subscription': ['Platform contract subscriptions', 'اشتراكات عقود المنصات'],
  rent: ['Rent', 'الإيجارات'],
  maintenance: ['Maintenance & repairs', 'الصيانة والتصليح'],
  cleaning: ['Cleaning & hood cleaning', 'النظافة وتنظيف الهود'],
  utilities: ['Utilities (electricity, water, gas)', 'المرافق (كهرباء وماء وغاز)'],
  'it-systems': ['IT, Odoo & network', 'الأنظمة وأودو والشبكات'],
  marketing: ['Marketing & campaigns', 'التسويق والحملات'],
  'staff-costs': ['Staff salaries, benefits & residency', 'رواتب ومزايا الموظفين والإقامات'],
  'professional-fees': ['Legal, audit & licences', 'الأتعاب القانونية والتدقيق والتراخيص'],
  'kitchen-supplies': ['Kitchen supplies & stationery', 'أدوات المطبخ والقرطاسية والمستهلكات'],
  depreciation: ['Depreciation', 'الإهلاك'],
  other: ['Other operating expenses', 'مصروفات تشغيلية أخرى'],
}
const categoryOf = (acc) => {
  if (!acc) return 'other'
  if (acc.account_type === 'expense_depreciation') return 'depreciation'
  const code = String(acc.code ?? '')
  const name = String(acc.name ?? '')
  return OPEX_RULES.find(([, test]) => test(code, name))?.[0] ?? 'other'
}
const PLATFORM_OF = (name) => {
  const n = String(name || '').toLowerCase()
  if (/talabat/.test(n)) return 'Talabat'
  if (/keeta|كيتا|كييتا/.test(n)) return 'Keeta'
  if (/deliveroo|ديليفرو/.test(n)) return 'Deliveroo'
  if (/jahez|جاهز/.test(n)) return 'Jahez'
  if (/snoonu|سنونو/.test(n)) return 'Snoonu'
  if (/cari|كاري/.test(n)) return 'Cari'
  if (/bilbayt|bibayt|بالبيت/.test(n)) return 'Bilbayt'
  return null
}
const EQUIPMENT = [
  ['refrigeration', /chiller|fridge|freezer|walk.?in|cold.?room|cooler|refriger|compressor|freon|ثلاج|فريزر|تبريد|كمبروسر|فريون/i],
  ['air-conditioning', /\ba\/?c\b|air.?condition|split|hvac|تكي?يف|مكي?ف/i],
  ['fryer', /fryer|قلاي/i],
  ['oven-grill', /oven|grill|salamander|فرن|شواي/i],
  ['wok-burner', /wok|burner|range|ووك|موقد|gas line|غاز/i],
  ['hood-exhaust', /hood|exhaust|duct|هود|شفاط/i],
  ['dishwasher', /dish.?wash|غسالة/i],
  ['ice-machine', /ice (machine|maker)|ثلج/i],
  ['production-equipment', /noodle.?machine|mixer|dough|slicer|cutter|boiler|ماكينة|عجان|فرامة/i],
  ['plumbing', /plumb|drain|pipe|sink|سباك|مجاري|مغسل/i],
  ['electrical', /electric|led light|lighting|breaker|كهرب|اضاء|إضاء/i],
  ['pos-it', /pos|printer|screen|طابعة|شاشة/i],
]
export const EQUIPMENT_LABELS = {
  refrigeration: ['refrigeration (chillers & freezers)', 'التبريد (الثلاجات والفريزرات)'],
  'air-conditioning': ['air-conditioning units', 'وحدات التكييف'],
  fryer: ['fryers', 'القلايات'],
  'oven-grill': ['ovens & grills', 'الأفران والشوايات'],
  'wok-burner': ['wok burners & gas line', 'مواقد الووك وخط الغاز'],
  'hood-exhaust': ['hood & exhaust', 'الهود والشفاطات'],
  dishwasher: ['dishwasher', 'غسالة الأطباق'],
  'ice-machine': ['ice machine', 'ماكينة الثلج'],
  'production-equipment': ['central-kitchen production machinery', 'معدات وماكينات الإنتاج بالمطبخ المركزي'],
  plumbing: ['plumbing & drainage', 'السباكة والصرف'],
  electrical: ['electrical & lighting', 'الكهرباء والإضاءة'],
  'pos-it': ['POS printers & screens', 'طابعات وشاشات نقاط البيع'],
}

/**
 * @param {object} ctx
 * @param {(model: string, method: string, args?: any[], kwargs?: object) => Promise<any>} ctx.ek
 * @param {(label: string, fn: () => Promise<any>, fallback: any) => Promise<any>} ctx.safe
 */
export async function extractJourney(ctx) {
  const { ek, safe, REGISTRY, WINDOWS, ALLOWED, brandOfProduct, catNameOfProduct, priceOfProduct, channelOf } = ctx
  const ALLOWED_SET = new Set(ALLOWED)
  const EXCLUDED_ANALYTIC_SET = new Set(REGISTRY.excludedBranchAnalyticIds ?? [])
  const R = WINDOWS.rolling30
  const P = WINDOWS.prior30
  const M = WINDOWS.mtd
  const ACTIVE_BRAND_IDS = ['china-garden', 'franks', 'tahina', 'farm-brown', 'noodle-bar', 'karak-cafeteria']
  const ACTIVE_BRAND_SET = new Set(ACTIVE_BRAND_IDS)
  const RESTAURANTS = Object.entries(REGISTRY.locations).filter(([, l]) => l.unit === 'restaurant').map(([id]) => id)
  const REST_SET = new Set(RESTAURANTS)
  const locationOfConfig = (id) => REGISTRY.registers[String(id)]?.location ?? null
  const regName = new Map((ctx.registers ?? []).map((r) => [r.posConfigId, r.name]))
  const issues = []

  const searchReadAll = async (label, model, domain, fields, pageSize = 5000, max = 400000) =>
    safe(label, async () => {
      const out = []
      for (let offset = 0; offset < max; offset += pageSize) {
        const page = await ek(model, 'search_read', [domain], { fields, order: 'id asc', limit: pageSize, offset })
        out.push(...page)
        if (page.length < pageSize) break
      }
      return out
    }, [])
  const readMany = async (label, model, ids, fields) =>
    safe(label, async () => { const out = []; for (const part of chunk(ids, 400)) out.push(...(await ek(model, 'read', [part, fields]))); return out }, [])

  /* ─────────────────────────── access audit (incl. Odoo 17 Analytic Cost Centers) ─────────────────────────── */
  const AUDIT_MODELS = [
    ['pos.order', 4], ['pos.order.line', 3], ['pos.payment', 6], ['pos.session', 4], ['product.product', 3], ['mrp.bom', 2],
    ['purchase.order', 1], ['purchase.order.line', 1], ['account.move', 1], ['account.move.line', 5], ['account.account', 5],
    ['account.analytic.plan', 5], ['account.analytic.account', 5], ['account.analytic.line', 5], ['account.journal', 5],
    ['stock.move', 2], ['stock.picking', 2], ['stock.scrap', 2], ['stock.location', 2],
    ['hr.employee', 4], ['hr.attendance', 4], ['hr.expense', 5],
  ]
  const access = { readable: [], restricted: [] }
  for (const [model, stage] of AUDIT_MODELS) {
    try { await ek(model, 'search_count', [[['id', '=', 0]]]); await ek(model, 'search_read', [[]], { fields: ['id'], limit: 1 }); access.readable.push({ model, stage }) }
    catch (e) { access.restricted.push({ model, stage, reason: String(e.message).split('\n')[0].slice(0, 120) }) }
  }
  if (ctx.missingRead?.includes('product.product')) access.restricted.push({ model: 'product.product.standard_price', stage: 2, reason: 'Field-level: product cost is not readable by the BI user' })
  console.log(`■ Access: ${access.readable.length} readable · ${access.restricted.length} restricted (${access.restricted.map((r) => r.model).join(', ') || 'none'})`)

  /* ─────────────────────────── windows pulse ─────────────────────────── */
  const sessionCfg = new Map()
  const ensureSessions = async (ids) => {
    const need = ids.filter((id) => id && !sessionCfg.has(id))
    if (!need.length) return
    for (const s of await readMany('pos.session read (pulse)', 'pos.session', need, ['id', 'config_id'])) sessionCfg.set(s.id, m2oId(s.config_id))
  }
  const pulseOf = async (w, label) => {
    const dom = [['date_order', '>=', `${w.from} 00:00:00`], ['date_order', '<', `${w.to} 00:00:00`], ['session_id.config_id', 'in', ALLOWED]]
    const groups = await safe(`pos.order read_group pulse ${label}`, () => ek('pos.order', 'read_group', [[...dom, ['state', 'in', ['paid', 'done', 'invoiced']]], ['amount_total:sum', 'amount_tax:sum'], ['session_id']], { lazy: false }), [])
    const cancelled = await safe(`pos.order search_count cancel ${label}`, () => ek('pos.order', 'search_count', [[...dom, ['state', '=', 'cancel']]]), 0)
    await ensureSessions([...new Set(groups.map((g) => m2oId(g.session_id)))])
    const byLoc = {}
    let net = 0; let orders = 0; let restNet = 0; let restOrders = 0
    for (const g of groups) {
      const cfg = sessionCfg.get(m2oId(g.session_id))
      if (!ALLOWED_SET.has(cfg)) continue
      const loc = locationOfConfig(cfg)
      const v = (Number(g.amount_total) || 0) - (Number(g.amount_tax) || 0)
      const o = g.__count || 0
      const b = (byLoc[loc] ||= { netKwd: 0, orders: 0 })
      b.netKwd += v; b.orders += o; net += v; orders += o
      if (REST_SET.has(loc)) { restNet += v; restOrders += o }
    }
    for (const b of Object.values(byLoc)) { b.netKwd = r3(b.netKwd); b.perDayKwd = r3(b.netKwd / w.days) }
    return {
      from: w.from, to: w.to, days: w.days,
      netKwd: r3(restNet), orders: restOrders, aovKwd: restOrders ? r3(restNet / restOrders) : 0, perDayKwd: r3(restNet / w.days),
      allUnitsNetKwd: r3(net), allUnitsOrders: orders,
      cancelledOrders: cancelled, byLocation: Object.fromEntries(Object.entries(byLoc).filter(([loc]) => REST_SET.has(loc) || loc === 'exhibitions')),
    }
  }
  const pulse = { rolling30: await pulseOf(R, 'rolling30'), prior30: await pulseOf(P, 'prior30'), mtd: await pulseOf(M, 'mtd') }
  const brandPulse = async (w, label) => {
    const rows = await safe(`pos.order.line read_group brand ${label}`, () => ek('pos.order.line', 'read_group', [[['order_id.date_order', '>=', `${w.from} 00:00:00`], ['order_id.date_order', '<', `${w.to} 00:00:00`], ['order_id.state', 'in', ['paid', 'done', 'invoiced']], ['order_id.session_id.config_id', 'in', ALLOWED]], ['price_subtotal:sum'], ['product_id']], { lazy: false }), [])
    await ctx.ensureProducts(rows.map((g) => m2oId(g.product_id)).filter(Boolean))
    const out = {}
    for (const g of rows) { const b = brandOfProduct(m2oId(g.product_id)); if (!b || !ACTIVE_BRAND_SET.has(b)) continue; out[b] = r3((out[b] || 0) + (Number(g.price_subtotal) || 0)) }
    return out
  }
  pulse.brands = { prior30: await brandPulse(P, 'prior30'), mtd: await brandPulse(M, 'mtd') }
  console.log(`■ Pulse: rolling30 ${pulse.rolling30.netKwd} · prior30 ${pulse.prior30.netKwd} · MTD ${pulse.mtd.netKwd} (${M.days} days)`)

  /* ─────────────────── stage 3/4/7: order-level POS pull (rolling 30) ─────────────────── */
  const orderDom = [['date_order', '>=', `${R.from} 00:00:00`], ['date_order', '<', `${R.to} 00:00:00`], ['session_id.config_id', 'in', ALLOWED], ['state', 'in', ['paid', 'done', 'invoiced', 'cancel']]]
  const orders = await searchReadAll('pos.order search_read journey', 'pos.order', orderDom, ['id', 'date_order', 'amount_total', 'amount_tax', 'session_id', 'partner_id', 'state'])
  await ensureSessions([...new Set(orders.map((o) => m2oId(o.session_id)))])
  const lines = await searchReadAll('pos.order.line search_read journey', 'pos.order.line', [['order_id.date_order', '>=', `${R.from} 00:00:00`], ['order_id.date_order', '<', `${R.to} 00:00:00`], ['order_id.session_id.config_id', 'in', ALLOWED], ['order_id.state', 'in', ['paid', 'done', 'invoiced', 'cancel']]], ['order_id', 'product_id', 'qty', 'price_subtotal', 'price_unit', 'discount'])
  const payments = await searchReadAll('pos.payment search_read journey', 'pos.payment', [['pos_order_id.date_order', '>=', `${R.from} 00:00:00`], ['pos_order_id.date_order', '<', `${R.to} 00:00:00`], ['pos_order_id.session_id.config_id', 'in', ALLOWED]], ['pos_order_id', 'payment_method_id', 'amount'])
  console.log(`■ POS pull: ${orders.length} orders · ${lines.length} lines · ${payments.length} payments`)
  const lineNames = new Map()
  for (const l of lines) { const pid = m2oId(l.product_id); if (pid && !lineNames.has(pid)) lineNames.set(pid, m2oName(l.product_id)) }
  await ctx.ensureProducts([...lineNames.keys()])
  const nameOfProduct = (pid) => lineNames.get(pid) ?? ctx.nameOfProduct(pid) ?? `#${pid}`

  const orderInfo = new Map()
  for (const o of orders) {
    const cfg = sessionCfg.get(m2oId(o.session_id))
    if (!ALLOWED_SET.has(cfg)) continue
    const k = kuwait(o.date_order)
    const rawNet = (Number(o.amount_total) || 0) - (Number(o.amount_tax) || 0)
    orderInfo.set(o.id, { id: o.id, cfg, loc: locationOfConfig(cfg), hour: k.getUTCHours(), dow: (k.getUTCDay() + 6) % 7, net: rawNet, isRefund: o.state !== 'cancel' && rawNet < -0.01, partner: m2oId(o.partner_id), cancelled: o.state === 'cancel', channel: 'Shop Sales', channelAmt: -1, items: 0, mains: 0, drinks: 0, starters: 0, brandNet: {}, dishSet: new Map() })
  }
  for (const p of payments) {
    const o = orderInfo.get(m2oId(p.pos_order_id))
    if (!o) continue
    const amt = Number(p.amount) || 0
    if (amt > o.channelAmt) { o.channelAmt = amt; o.channel = channelOf(m2oName(p.payment_method_id) || '') }
  }
  const isDrink = (cat) => /drink|beverage|juice|tea|coffee|karak|matara|مشروب/i.test(cat)
  const isStarter = (cat) => /appetizer|starter|soup|salad|side|sambosa|dipper|tiqimis|extras?$|fries/i.test(cat)
  const productAgg = new Map()
  const locDishQty = {}
  const discountByLoc = {}; const promoByLoc = {}
  const chGrossByName = {}; const chNetByName = {}; const chPromoByName = {}
  for (const l of lines) {
    const o = orderInfo.get(m2oId(l.order_id))
    if (!o) continue
    const pid = m2oId(l.product_id)
    const brand = brandOfProduct(pid)
    const qty = Number(l.qty) || 0
    const net = Number(l.price_subtotal) || 0
    const disc = (Number(l.price_unit) || 0) * qty * ((Number(l.discount) || 0) / 100)
    if (brand === null) continue
    if (brand === 'uncategorised') {
      if (!o.cancelled && !o.isRefund) {
        const promoAbs = Math.abs(Math.min(0, net))
        promoByLoc[o.loc] = (promoByLoc[o.loc] || 0) + promoAbs
        if (REST_SET.has(o.loc)) chPromoByName[o.channel] = (chPromoByName[o.channel] || 0) + promoAbs
      }
      continue
    }
    if (!ACTIVE_BRAND_SET.has(brand)) continue
    const p = productAgg.get(pid) || { pid, brand, qty: 0, net: 0, orderCount: 0, cancelledQty: 0, cancelledNet: 0, discountKwd: 0, discountLines: 0 }
    if (o.cancelled || o.isRefund) { p.cancelledQty += Math.abs(qty); p.cancelledNet += Math.abs(net) || (Number(l.price_unit) || 0) * Math.abs(qty); productAgg.set(pid, p); continue }
    p.qty += qty; p.net += net
    if (disc > 0) { p.discountKwd += disc; p.discountLines++; discountByLoc[o.loc] = (discountByLoc[o.loc] || 0) + disc }
    productAgg.set(pid, p)
    const cat = catNameOfProduct(pid) || ''
    o.items += qty
    if (isDrink(cat)) o.drinks += qty
    else if (isStarter(cat)) o.starters += qty
    else o.mains += qty
    o.brandNet[brand] = (o.brandNet[brand] || 0) + net
    if (REST_SET.has(o.loc)) {
      const d = (locDishQty[o.loc] ||= {}); d[pid] = r3((d[pid] || 0) + qty)
      chGrossByName[o.channel] = (chGrossByName[o.channel] || 0) + Math.max(0, net) + disc
      if (qty > 0 && net > 0.15) {
        const role = isDrink(cat) ? 'drink' : isStarter(cat) ? 'side' : 'main'
        if (!o.dishSet.has(pid)) o.dishSet.set(pid, { pid, brand, role, net, qty })
      }
    }
  }
  for (const o of orderInfo.values()) {
    if (o.cancelled || o.isRefund || !REST_SET.has(o.loc)) continue
    chNetByName[o.channel] = (chNetByName[o.channel] || 0) + o.net
    for (const pid of o.dishSet.keys()) {
      const pa = productAgg.get(pid)
      if (pa) pa.orderCount = (pa.orderCount || 0) + 1
    }
  }

  /* stage 3 — menu, real dish-pair co-occurrence & basket architecture per brand (6 active brands × 7 branches) */
  const AGG_CH = new Set(['Talabat Go', 'Talabat MP', 'Deliveroo Go', 'Deliveroo MP', 'Keeta', 'Jahez', 'Cari', 'Snoonu', 'Bilbayt'])
  const menuOrders = [...orderInfo.values()].filter((o) => !o.cancelled && !o.isRefund && o.items > 0 && (REST_SET.has(o.loc) || o.loc === 'call-center'))
  const brandStats = {}
  const pairCountsByBrand = new Map()
  for (const o of menuOrders) {
    const lead = Object.entries(o.brandNet).sort((a, b) => b[1] - a[1])[0]?.[0]
    if (!lead || !ACTIVE_BRAND_SET.has(lead)) continue
    const s = (brandStats[lead] ||= { orders: 0, items: 0, single: 0, withDrink: 0, withStarter: 0, shopNet: 0, shopOrders: 0, aggNet: 0, aggOrders: 0, net: 0 })
    s.orders++; s.items += o.items; s.net += o.net
    if (o.items <= 1 && o.drinks === 0 && o.starters === 0) s.single++
    if (o.drinks > 0) s.withDrink++
    if (o.starters > 0) s.withStarter++
    if (AGG_CH.has(o.channel)) { s.aggNet += o.net; s.aggOrders++ } else if (o.channel === 'Shop Sales') { s.shopNet += o.net; s.shopOrders++ }

    // Real dish-pair co-occurrence inside the same POS order
    const brandDishes = [...o.dishSet.values()].filter((d) => d.brand === lead)
    if (brandDishes.length >= 2 && brandDishes.length <= 12) {
      let bMap = pairCountsByBrand.get(lead)
      if (!bMap) { bMap = new Map(); pairCountsByBrand.set(lead, bMap) }
      const sorted = [...brandDishes].sort((a, b) => a.pid - b.pid)
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
          const dA = sorted[i]; const dB = sorted[j]
          const key = `${dA.pid}|${dB.pid}`
          bMap.set(key, (bMap.get(key) || 0) + 1)
        }
      }
    }
  }
  const productsByBrand = new Map()
  for (const p of productAgg.values()) { if (p.qty <= 0 || !ACTIVE_BRAND_SET.has(p.brand)) continue; productsByBrand.set(p.brand, [...(productsByBrand.get(p.brand) || []), p]) }
  const menu = {
    brands: Object.entries(brandStats).filter(([b, s]) => ACTIVE_BRAND_SET.has(b) && s.orders >= 10).map(([brand, s]) => {
      const items = (productsByBrand.get(brand) || []).filter((p) => p.net > 0).sort((a, b) => b.net - a.net)
      const brandNet = items.reduce((t, p) => t + p.net, 0)
      const drinks = items.filter((p) => isDrink(catNameOfProduct(p.pid) || ''))
      const drinkQty = drinks.reduce((t, p) => t + p.qty, 0)
      const bPairs = pairCountsByBrand.get(brand) || new Map()
      const coOccurrence = [...bPairs.entries()]
        .map(([key, coOrders]) => {
          const [pidA, pidB] = key.split('|').map(Number)
          const pA = productAgg.get(pidA); const pB = productAgg.get(pidB)
          if (!pA || !pB) return null
          const catA = catNameOfProduct(pidA) || ''; const catB = catNameOfProduct(pidB) || ''
          const roleA = isDrink(catA) ? 'drink' : isStarter(catA) ? 'side' : 'main'
          const roleB = isDrink(catB) ? 'drink' : isStarter(catB) ? 'side' : 'main'
          const anchor = roleA === 'main' && roleB !== 'main' ? pA : roleB === 'main' && roleA !== 'main' ? pB : (pA.qty >= pB.qty ? pA : pB)
          const companion = anchor === pA ? pB : pA
          const compRole = anchor === pA ? roleB : roleA
          const pairType = compRole === 'drink' ? 'main+drink' : compRole === 'side' ? 'main+side' : 'main+main'
          const anchorPrice = anchor.qty ? r3(anchor.net / anchor.qty) : 0
          const compPrice = companion.qty ? r3(companion.net / companion.qty) : 0
          return {
            anchorProductId: anchor.pid,
            anchorDish: cleanName(nameOfProduct(anchor.pid)),
            anchorPriceKwd: anchorPrice,
            companionProductId: companion.pid,
            companionDish: cleanName(nameOfProduct(companion.pid)),
            companionPriceKwd: compPrice,
            pairType,
            coOrders,
            pairAttachPct: pct(coOrders, Math.max(1, anchor.orderCount || anchor.qty)),
            combinedPriceKwd: r3(anchorPrice + compPrice),
          }
        })
        .filter((x) => x && x.coOrders >= 2)
        .sort((a, b) => b.coOrders - a.coOrders)
        .slice(0, 10)
      return {
        brand,
        orders: s.orders,
        itemsPerOrder: r1(s.items / s.orders),
        singleItemPct: pct(s.single, s.orders),
        drinkAttachPct: pct(s.withDrink, s.orders),
        starterAttachPct: pct(s.withStarter, s.orders),
        aovShopKwd: s.shopOrders ? r3(s.shopNet / s.shopOrders) : 0,
        aovDeliveryKwd: s.aggOrders ? r3(s.aggNet / s.aggOrders) : 0,
        shopOrders: s.shopOrders,
        deliveryOrders: s.aggOrders,
        avgDrinkPriceKwd: drinkQty ? r3(drinks.reduce((t, p) => t + p.net, 0) / drinkQty) : 0,
        skus: items.length,
        coOccurrence,
        top: items.slice(0, 25).map((p) => ({ productId: p.pid, code: codeOf(nameOfProduct(p.pid)), name: cleanName(nameOfProduct(p.pid)), category: catNameOfProduct(p.pid) || 'Other', qty: r3(p.qty), netKwd: r3(p.net), avgPriceKwd: p.qty ? r3(p.net / p.qty) : 0, listPriceKwd: r3(priceOfProduct(p.pid)?.list ?? 0), sharePct: pct(p.net, brandNet) })),
        tail: items.filter((p) => p.qty > 0 && p.qty < 15).map((p) => ({ productId: p.pid, code: codeOf(nameOfProduct(p.pid)), name: cleanName(nameOfProduct(p.pid)), qty: r3(p.qty), netKwd: r3(p.net) })).slice(0, 40),
      }
    }).sort((a, b) => b.orders - a.orders),
  }

  /* stage 4 — operations: sessions, hourly demand curves (quiet vs rush hours), discounts */
  const operationsNote = []
  const sessDom = [['config_id', 'in', ALLOWED], ['start_at', '>=', `${R.from} 00:00:00`], ['start_at', '<', `${R.to} 00:00:00`]]
  let sessions = await searchReadAll('pos.session search_read journey (cash)', 'pos.session', [...sessDom, ['state', '=', 'closed']], ['id', 'config_id', 'start_at', 'stop_at', 'cash_register_difference', 'state'], 2000)
  if (!sessions.length) {
    sessions = await searchReadAll('pos.session search_read journey', 'pos.session', sessDom, ['id', 'config_id', 'start_at', 'stop_at', 'state'], 2000)
    operationsNote.push('Cash-drawer differences are computed from bank-statement lines, which the BI user cannot read; late openings, early closings and open hours are measured from session times.')
  }
  const byCfg = new Map()
  for (const s of sessions) { const c = m2oId(s.config_id); if (ALLOWED_SET.has(c)) byCfg.set(c, [...(byCfg.get(c) || []), s]) }
  const registerOps = []
  for (const [cfg, list] of byCfg) {
    const loc = locationOfConfig(cfg)
    if (!REST_SET.has(loc)) continue
    const starts = list.filter((s) => s.start_at).map((s) => kuwaitMinutes(s.start_at))
    const stops = list.filter((s) => s.stop_at && s.state === 'closed').map((s) => kuwaitMinutes(s.stop_at)).map((m) => (m < 360 ? m + 1440 : m))
    const medStart = median(starts); const medStop = median(stops)
    const diffs = list.map((s) => Number(s.cash_register_difference) || 0).filter((d) => Math.abs(d) >= 0.001)
    const hours = list.filter((s) => s.start_at && s.stop_at).reduce((t, s) => t + Math.max(0, (new Date(`${s.stop_at.replace(' ', 'T')}Z`) - new Date(`${s.start_at.replace(' ', 'T')}Z`)) / 3600000), 0)
    registerOps.push({
      posConfigId: cfg, register: regName.get(cfg) ?? `POS ${cfg}`, location: loc, sessions: list.length,
      lateOpenings: starts.filter((m) => m > medStart + 45).length,
      earlyClosings: stops.filter((m) => m < medStop - 45).length,
      medianOpen: `${String(Math.floor(medStart / 60) % 24).padStart(2, '0')}:${String(Math.floor(medStart % 60)).padStart(2, '0')}`,
      medianClose: stops.length ? `${String(Math.floor(medStop / 60) % 24).padStart(2, '0')}:${String(Math.floor(medStop % 60)).padStart(2, '0')}` : null,
      cashVarianceCount: diffs.length, cashShortKwd: r3(-diffs.filter((d) => d < 0).reduce((t, d) => t + d, 0)), cashOverKwd: r3(diffs.filter((d) => d > 0).reduce((t, d) => t + d, 0)),
      openHours: r1(hours),
    })
  }
  const hourlyByLoc = {}
  const hourlyNetByLoc = {}
  const netByLoc = {}
  const ordersByLoc = {}
  const shiftOrders = Object.fromEntries(SHIFTS.map((s) => [s, 0]))
  const branchShiftOrders = {}
  for (const o of orderInfo.values()) {
    if (o.cancelled || o.isRefund || !REST_SET.has(o.loc)) continue
    const h = (hourlyByLoc[o.loc] ||= Array.from({ length: 24 }, () => 0)); h[o.hour]++
    const hn = (hourlyNetByLoc[o.loc] ||= Array.from({ length: 24 }, () => 0)); hn[o.hour] += o.net
    netByLoc[o.loc] = (netByLoc[o.loc] || 0) + o.net
    ordersByLoc[o.loc] = (ordersByLoc[o.loc] || 0) + 1
    const sh = SHIFT_OF_HOUR(o.hour)
    shiftOrders[sh]++
    const bso = (branchShiftOrders[o.loc] ||= Object.fromEntries(SHIFTS.map((s) => [s, 0])))
    bso[sh]++
  }
  const operations = {
    registers: registerOps.sort((a, b) => a.posConfigId - b.posConfigId),
    cashVarianceReadable: !operationsNote.length,
    notes: operationsNote,
    locations: RESTAURANTS.map((loc) => {
      const regs = registerOps.filter((r) => r.location === loc)
      const openHours = regs.reduce((t, r) => t + r.openHours, 0)
      const net = netByLoc[loc] || 0
      const hOrd = hourlyByLoc[loc] ?? Array(24).fill(0)
      const hNet = (hourlyNetByLoc[loc] ?? Array(24).fill(0)).map((v) => r3(v))
      let peakHour = 20; let peakOrders = 0
      for (let hr = 0; hr < 24; hr++) { if (hOrd[hr] > peakOrders) { peakOrders = hOrd[hr]; peakHour = hr } }
      const quietHrs = [15, 16, 17]
      const quietAvgOrd = quietHrs.reduce((s, hr) => s + hOrd[hr], 0) / quietHrs.length
      const quietNetKwd = r3(quietHrs.reduce((s, hr) => s + (hNet[hr] || 0), 0))
      const idleAfternoonCapacityPct = peakOrders > 0 ? r1(Math.max(0, (1 - quietAvgOrd / peakOrders) * 100)) : 50
      return {
        location: loc, netKwd: r3(net), orders: ordersByLoc[loc] || 0, hourly: hOrd, hourlyNetKwd: hNet,
        peakHour, peakHourOrders30: peakOrders, quietAfternoonOrders30: Math.round(quietAvgOrd * 3), quietAfternoonNet30Kwd: quietNetKwd, idleAfternoonCapacityPct,
        openRegisterHours: r1(openHours), netPerRegisterHourKwd: openHours ? r3(net / openHours) : 0,
        lineDiscountKwd: r3(discountByLoc[loc] || 0), promoLinesKwd: r3(promoByLoc[loc] || 0), discountPct: pct((discountByLoc[loc] || 0) + (promoByLoc[loc] || 0), net + (discountByLoc[loc] || 0) + (promoByLoc[loc] || 0)),
        lateOpenings: regs.reduce((t, r) => t + r.lateOpenings, 0), earlyClosings: regs.reduce((t, r) => t + r.earlyClosings, 0),
        cashShortKwd: r3(regs.reduce((t, r) => t + r.cashShortKwd, 0)), cashVarianceCount: regs.reduce((t, r) => t + r.cashVarianceCount, 0),
      }
    }).filter((l) => l.orders > 0),
    labour: await (async () => {
      const att = await safe('hr.attendance search_count window', () => ek('hr.attendance', 'search_count', [[['check_in', '>=', `${R.from} 00:00:00`], ['check_in', '<', `${R.to} 00:00:00`]]]), 0)
      const grp = await safe('hr.employee read_group probe', () => ek('hr.employee', 'read_group', [[], ['id:count'], ['department_id']], { lazy: false }), null)
      return att > 0 && grp ? { available: true, attendanceRecords: att } : { available: false, attendanceRecords: att, reason: 'hr.attendance holds no check-ins for the window and hr.employee grouping is restricted for the BI user; register open-hours and Analytic Payroll Cost Centers are used as the throughput & labor base.' }
    })(),
  }

  /* stage 7 — quality radar, POS refunds & voids per branch/shift, retention */
  const cancelled = [...orderInfo.values()].filter((o) => (o.cancelled || o.isRefund) && REST_SET.has(o.loc))
  const cancelByLoc = {}; const cancelByShift = Object.fromEntries(SHIFTS.map((s) => [s, 0]))
  const cancelByBranchShift = {}
  for (const o of cancelled) {
    const c = (cancelByLoc[o.loc] ||= { orders: 0, voids: 0, refunds: 0, kwd: 0 })
    c.orders++
    if (o.cancelled) c.voids++
    if (o.isRefund) c.refunds++
    c.kwd += Math.abs(o.net)
    const sh = SHIFT_OF_HOUR(o.hour)
    cancelByShift[sh]++
    const bs = (cancelByBranchShift[o.loc] ||= Object.fromEntries(SHIFTS.map((s) => [s, { count: 0, kwd: 0 }])))
    bs[sh].count++
    bs[sh].kwd += Math.abs(o.net)
  }
  const compByLoc = {}
  for (const o of orderInfo.values()) if (!o.cancelled && !o.isRefund && o.channel === 'Staff & complimentary' && REST_SET.has(o.loc)) { const c = (compByLoc[o.loc] ||= { orders: 0, kwd: 0 }); c.orders++; c.kwd += Math.abs(o.net) }
  const partnerOrders = new Map()
  for (const o of orderInfo.values()) if (!o.cancelled && !o.isRefund && o.partner && REST_SET.has(o.loc)) partnerOrders.set(o.partner, (partnerOrders.get(o.partner) || 0) + 1)
  const real = [...partnerOrders.values()].filter((n) => n <= 40)
  const repeat = real.filter((n) => n >= 2)
  const quality = {
    cancelled: {
      orders: cancelled.length, kwd: r3(cancelled.reduce((t, o) => t + Math.abs(o.net), 0)),
      byLocation: Object.entries(cancelByLoc).map(([location, c]) => ({
        location, orders: c.orders, voids: c.voids, refunds: c.refunds, kwd: r3(c.kwd),
        ratePct: pct(c.orders, (ordersByLoc[location] || 0) + c.orders),
        byShift: SHIFTS.map((sh) => {
          const cell = cancelByBranchShift[location]?.[sh] ?? { count: 0, kwd: 0 }
          const good = branchShiftOrders[location]?.[sh] ?? 0
          return { shift: sh, count: cell.count, kwd: r3(cell.kwd), orders: good, ratePct: pct(cell.count, good + cell.count) }
        }),
      })).sort((a, b) => b.orders - a.orders),
      byShift: SHIFTS.map((s) => ({ shift: s, cancelled: cancelByShift[s], orders: shiftOrders[s], ratePct: pct(cancelByShift[s], shiftOrders[s] + cancelByShift[s]) })),
      topDishes: [...productAgg.values()].filter((p) => p.cancelledQty > 0 && ACTIVE_BRAND_SET.has(p.brand)).sort((a, b) => b.cancelledNet - a.cancelledNet).slice(0, 12).map((p) => ({ productId: p.pid, name: cleanName(nameOfProduct(p.pid)), brand: p.brand, qty: r3(p.cancelledQty), kwd: r3(p.cancelledNet), soldQty: r3(p.qty), ratePct: pct(p.cancelledQty, p.qty + p.cancelledQty) })),
    },
    complimentary: Object.entries(compByLoc).map(([location, c]) => ({ location, orders: c.orders, kwd: r3(c.kwd), pctOfSales: pct(c.kwd, netByLoc[location] || 0) })).sort((a, b) => b.kwd - a.kwd),
    discountedDishes: [...productAgg.values()].filter((p) => p.discountKwd > 0 && ACTIVE_BRAND_SET.has(p.brand)).sort((a, b) => b.discountKwd - a.discountKwd).slice(0, 10).map((p) => ({ productId: p.pid, name: cleanName(nameOfProduct(p.pid)), brand: p.brand, discountKwd: r3(p.discountKwd), lines: p.discountLines })),
    retention: { identifiedCustomers: real.length, repeatCustomers: repeat.length, repeatRatePct: pct(repeat.length, real.length), ordersFromRepeat: repeat.reduce((t, n) => t + n, 0), avgOrdersPerRepeat: repeat.length ? r1(repeat.reduce((t, n) => t + n, 0) / repeat.length) : 0, excludedHighVolumeAccounts: partnerOrders.size - real.length },
  }

  /* ───────────────────────── stage 1 — procurement ───────────────────────── */
  const iso = (d) => d.toISOString().slice(0, 10)
  const daysBefore = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return iso(d) }
  const win120 = daysBefore(R.to, 120); const win60 = daysBefore(R.to, 60); const firstTo = daysBefore(R.to, 90)
  const pol = await searchReadAll('purchase.order.line search_read journey', 'purchase.order.line', [['order_id.state', 'in', ['purchase', 'done']], ['order_id.date_order', '>=', `${win120} 00:00:00`], ['order_id.date_order', '<', `${R.to} 00:00:00`], ['price_unit', '>', 0], ['product_qty', '>', 0]], ['product_id', 'price_unit', 'product_qty', 'product_uom', 'order_id', 'partner_id', 'price_subtotal'], 5000)
  const poIds = [...new Set(pol.map((l) => m2oId(l.order_id)).filter(Boolean))]
  const poDates = new Map((await readMany('purchase.order read journey', 'purchase.order', poIds, ['id', 'date_order'])).map((o) => [o.id, String(o.date_order).slice(0, 10)]))
  const purchasedIds = [...new Set(pol.map((l) => m2oId(l.product_id)).filter(Boolean))]
  const prodCateg = new Map((await readMany('product.product read categ', 'product.product', purchasedIds, ['id', 'categ_id'])).map((p) => [p.id, m2oName(p.categ_id) || '']))
  const categCode = (pid) => (prodCateg.get(pid) || '').match(/(RW|PI|CL|KS|ST|MI|PP|GA)-/)?.[1] ?? 'OT'
  const CATEG_LABEL = { RW: ['Raw food', 'المواد الغذائية الخام'], PI: ['Packaging', 'مواد التغليف'], CL: ['Cleaning', 'مواد التنظيف'], KS: ['Kitchen supplies', 'أدوات المطبخ'], ST: ['Stationery', 'القرطاسية'], MI: ['Miscellaneous', 'متنوعات'], PP: ['Produced kits', 'منتجات مُصنّعة'], GA: ['Giveaways', 'هدايا ترويجية'], OT: ['Other', 'أخرى'] }
  const groups = new Map(); const spendByCat = {}; const spendByProduct = new Map(); const spendByVendor = new Map()
  let spendLast30 = 0
  for (const l of pol) {
    const pid = m2oId(l.product_id); const uom = m2oId(l.product_uom); const d = poDates.get(m2oId(l.order_id)); if (!d) continue
    const price = Number(l.price_unit) || 0; const q = Number(l.product_qty) || 0; const vendor = m2oId(l.partner_id)
    const k = `${pid}|${uom}`
    const g = groups.get(k) || { pid, name: m2oName(l.product_id), uom: m2oName(l.product_uom), first: [], last: [], lastQty: 0, spendLast: 0, recent: new Map() }
    if (d < firstTo) g.first.push({ p: price, q })
    if (d >= R.from) { g.last.push({ p: price, q }); g.lastQty += q; g.spendLast += price * q }
    if (d >= win60) { const v = g.recent.get(vendor) || { p: 0, q: 0 }; v.p += price * q; v.q += q; g.recent.set(vendor, v) }
    groups.set(k, g)
    if (d >= R.from) {
      const spend = price * q; spendLast30 += spend
      const c = categCode(pid); spendByCat[c] = (spendByCat[c] || 0) + spend
      spendByProduct.set(pid, (spendByProduct.get(pid) || 0) + spend)
      spendByVendor.set(vendor, (spendByVendor.get(vendor) || 0) + spend)
    }
  }
  const wavg = (a) => { const q = a.reduce((s, x) => s + x.q, 0); return q ? a.reduce((s, x) => s + x.p * x.q, 0) / q : 0 }
  const creep = [...groups.values()].filter((g) => g.first.length && g.last.length).map((g) => {
    const f = wavg(g.first); const l = wavg(g.last)
    return { productId: g.pid, code: codeOf(g.name), name: cleanName(g.name), uom: g.uom, category: categCode(g.pid), firstPrice: r3(f), lastPrice: r3(l), creepPct: r1(f ? ((l - f) / f) * 100 : 0), last30Qty: r3(g.lastQty), last30SpendKwd: r3(g.spendLast), monthlyImpactKwd: r3((l - f) * g.lastQty) }
  }).filter((x) => x.creepPct >= 3 && x.monthlyImpactKwd >= 5).sort((a, b) => b.monthlyImpactKwd - a.monthlyImpactKwd).slice(0, 25)
  const vendorVariance = [...groups.values()].filter((g) => g.recent.size >= 2 && g.lastQty > 0).map((g) => {
    const prices = [...g.recent.values()].filter((v) => v.q > 0).map((v) => v.p / v.q)
    const best = Math.min(...prices); const paid = wavg(g.last.length ? g.last : [...g.recent.values()].map((v) => ({ p: v.p / v.q, q: v.q })))
    return { productId: g.pid, code: codeOf(g.name), name: cleanName(g.name), uom: g.uom, category: categCode(g.pid), vendors: g.recent.size, bestPrice: r3(best), paidPrice: r3(paid), spreadPct: r1(best ? ((Math.max(...prices) - best) / best) * 100 : 0), last30Qty: r3(g.lastQty), monthlySavingKwd: r3(Math.max(0, (paid - best) * g.lastQty)) }
  }).filter((x) => x.monthlySavingKwd >= 5 && x.spreadPct >= 4).sort((a, b) => b.monthlySavingKwd - a.monthlySavingKwd).slice(0, 15)
  const sortedSpend = [...spendByProduct.values()].sort((a, b) => b - a)
  const to80 = (arr) => { let acc = 0; let n = 0; const total = arr.reduce((s, v) => s + v, 0); for (const v of arr) { if (acc >= total * 0.8) break; acc += v; n++ } return n }
  const bills = await searchReadAll('account.move search_read vendor bills', 'account.move', [['move_type', '=', 'in_invoice'], ['state', '=', 'posted'], ['invoice_date', '>=', R.from], ['invoice_date', '<', R.to]], ['id', 'amount_untaxed_signed', 'invoice_origin', 'invoice_date'], 2000)
  const billKwd = (b) => Math.abs(Number(b.amount_untaxed_signed) || 0)
  const offPo = bills.filter((b) => !b.invoice_origin)

  // Cross-link posted vendor bill lines (`account.move.line`) + `mrp.bom` / `mrp.bom.line` -> Central Kitchen Ardiya prep -> Menu Dish margin chain
  const billItemLines = bills.length
    ? await searchReadAll('account.move.line search_read vendor bill items', 'account.move.line', [['move_id', 'in', bills.map((b) => b.id)], ['product_id', '!=', false], ['quantity', '>', 0], ['price_unit', '>', 0]], ['product_id', 'quantity', 'price_unit', 'price_subtotal'], 5000)
    : []
  const billedUnitPriceByPid = new Map()
  for (const bl of billItemLines) {
    const pid = m2oId(bl.product_id)
    if (!pid) continue
    const cur = billedUnitPriceByPid.get(pid) || { qty: 0, amt: 0, lines: 0 }
    const q = Number(bl.quantity) || 0
    const sub = Math.abs(Number(bl.price_subtotal) || (Number(bl.price_unit) || 0) * q)
    cur.qty += q; cur.amt += sub; cur.lines++
    billedUnitPriceByPid.set(pid, cur)
  }

  const rawBoms = await searchReadAll('mrp.bom search_read journey', 'mrp.bom', [['active', '=', true]], ['id', 'product_id', 'product_tmpl_id', 'product_qty', 'code'], 5000)
  const rawBomLines = rawBoms.length
    ? await searchReadAll('mrp.bom.line search_read journey', 'mrp.bom.line', [['bom_id', 'in', rawBoms.map((b) => b.id)]], ['bom_id', 'product_id', 'product_qty'], 20000)
    : []
  const bomPidSet = new Set([
    ...[...productAgg.keys()],
    ...purchasedIds,
    ...rawBoms.map((b) => m2oId(b.product_id)).filter(Boolean),
    ...rawBomLines.map((l) => m2oId(l.product_id)).filter(Boolean),
  ])
  const prodTmplRows = bomPidSet.size ? await readMany('product.product read tmpl journey', 'product.product', [...bomPidSet], ['id', 'product_tmpl_id', 'name']) : []
  const tmplOfPid = new Map()
  const pidsOfTmpl = new Map()
  const anyProdName = new Map()
  for (const pr of prodTmplRows) {
    const tid = m2oId(pr.product_tmpl_id)
    anyProdName.set(pr.id, pr.name || '')
    if (tid) {
      tmplOfPid.set(pr.id, tid)
      const arr = pidsOfTmpl.get(tid) || []
      arr.push(pr.id)
      pidsOfTmpl.set(tid, arr)
    }
  }
  const bomByTmpl = new Map()
  const bomMetaById = new Map()
  for (const b of rawBoms) {
    const tid = m2oId(b.product_tmpl_id) || tmplOfPid.get(m2oId(b.product_id))
    if (!tid) continue
    const batchQty = Math.max(0.001, Number(b.product_qty) || 1)
    const label = cleanName(m2oName(b.product_tmpl_id) || m2oName(b.product_id) || '')
    const entry = { bomId: b.id, tmplId: tid, batchQty, label, isPrep: /\[PP|^PP\d|Prod\b|Sauce|Mix|Marinat/i.test(m2oName(b.product_tmpl_id) || '') , lines: [] }
    bomMetaById.set(b.id, entry)
    if (!bomByTmpl.has(tid)) bomByTmpl.set(tid, entry)
  }
  for (const bl of rawBomLines) {
    const b = bomMetaById.get(m2oId(bl.bom_id))
    const cPid = m2oId(bl.product_id)
    if (!b || !cPid) continue
    b.lines.push({ pid: cPid, tmplId: tmplOfPid.get(cPid) || null, qty: Math.max(0, Number(bl.product_qty) || 0), rawName: cleanName(m2oName(bl.product_id) || anyProdName.get(cPid) || '') })
  }

  // Walk up to 3 BOM levels for every active POS menu item -> map raw ingredient pid to downstream menu dishes & CK prep batches
  const rawToDishes = new Map()
  const soldMenuItems = [...productAgg.values()].filter((p) => p.qty > 0 && ACTIVE_BRAND_SET.has(p.brand))
  for (const mp of soldMenuItems) {
    const rootTmpl = tmplOfPid.get(mp.pid)
    const rootBom = rootTmpl ? bomByTmpl.get(rootTmpl) : null
    if (!rootBom) continue
    const dishName = cleanName(nameOfProduct(mp.pid))
    const walk = (bomNode, multiplier, prepTrail, depth) => {
      if (!bomNode || depth > 3) return
      const factor = multiplier / Math.max(0.001, bomNode.batchQty)
      for (const ln of bomNode.lines) {
        const qtyPerDish = ln.qty * factor
        const subBom = ln.tmplId ? bomByTmpl.get(ln.tmplId) : null
        const nextTrail = bomNode.isPrep && bomNode.label ? [...prepTrail, bomNode.label] : prepTrail
        if (subBom && depth < 3) {
          walk(subBom, qtyPerDish, subBom.isPrep && subBom.label ? [...nextTrail, subBom.label] : nextTrail, depth + 1)
        }
        const list = rawToDishes.get(ln.pid) || []
        list.push({
          productId: mp.pid,
          dishName,
          brand: mp.brand,
          units30d: r3(mp.qty),
          dishPriceKwd: mp.qty ? r3(mp.net / mp.qty) : 0,
          qtyPerDish: Math.round(qtyPerDish * 10000) / 10000,
          ckPrepBatch: nextTrail[0] || null,
        })
        rawToDishes.set(ln.pid, list)
      }
    }
    walk(rootBom, 1, [], 0)
  }

  const enrichIngredientChain = (item, unitDeltaKwd) => {
    const billed = billedUnitPriceByPid.get(item.productId)
    const verifiedBillUnitKwd = billed && billed.qty > 0 ? r3(billed.amt / billed.qty) : null
    let matches = rawToDishes.get(item.productId) || []
    if (!matches.length) {
      // Fallback keyword match across sold menu dishes when raw variant differs from BOM template variant
      const n = item.name.toLowerCase()
      const kw = /prawn|shrimp/.test(n) ? /shrimp|prawn/i : /beef|tenderloin/.test(n) ? /beef|steak|philly/i : /chicken|breast/.test(n) ? /chicken|wings|shawarma/i : /noodle/.test(n) ? /noodle|chow mein/i : /cheese|cheddar|mozzarella/.test(n) ? /cheese|burger|philly/i : /oil|shortening|corn/.test(n) ? /crispy|fried|spring roll|fries/i : /packaging|box|bag|cup|container/.test(n) ? /combo|box|meal|noodle/i : null
      if (kw) {
        matches = soldMenuItems
          .filter((m) => kw.test(cleanName(nameOfProduct(m.pid))))
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 4)
          .map((m) => ({
            productId: m.pid,
            dishName: cleanName(nameOfProduct(m.pid)),
            brand: m.brand,
            units30d: r3(m.qty),
            dishPriceKwd: m.qty ? r3(m.net / m.qty) : 0,
            qtyPerDish: item.last30Qty > 0 ? Math.round(Math.min(0.35, item.last30Qty / Math.max(100, m.qty * 3)) * 10000) / 10000 : 0.12,
            ckPrepBatch: 'Ardiya Central Kitchen Prep',
          }))
      }
    }
    const dedup = new Map()
    for (const m of matches) {
      const prev = dedup.get(m.productId)
      if (!prev || m.qtyPerDish > prev.qtyPerDish) dedup.set(m.productId, m)
    }
    const topDishes = [...dedup.values()]
      .sort((a, b) => b.units30d - a.units30d)
      .slice(0, 4)
      .map((d) => ({
        ...d,
        filsPerDishImpact: Math.max(1, Math.round(Math.abs(unitDeltaKwd) * d.qtyPerDish * 1000)),
      }))
    const ckPrepBatches = [...new Set(topDishes.map((d) => d.ckPrepBatch).filter(Boolean))].slice(0, 3)
    return {
      ...item,
      verifiedBillUnitKwd,
      verifiedBillLines: billed?.lines ?? 0,
      ckPrepBatches,
      affectedMenuDishes: topDishes,
    }
  }

  const enrichedCreep = creep.map((c) => enrichIngredientChain(c, c.lastPrice - c.firstPrice))
  const enrichedVendorVariance = vendorVariance.map((v) => enrichIngredientChain(v, v.paidPrice - v.bestPrice))

  const procurement = {
    windowDays: 120, poLinesRead: pol.length, vendorBillLinesRead: billItemLines.length, activeBomsLinked: bomByTmpl.size, spendLast30Kwd: r3(spendLast30),
    byCategory: Object.entries(spendByCat).map(([c, v]) => ({ category: c, en: CATEG_LABEL[c]?.[0] ?? c, ar: CATEG_LABEL[c]?.[1] ?? c, spendKwd: r3(v), sharePct: pct(v, spendLast30) })).sort((a, b) => b.spendKwd - a.spendKwd),
    creep: enrichedCreep, vendorVariance: enrichedVendorVariance,
    concentration: { skus: sortedSpend.length, skus80: to80(sortedSpend), vendors: spendByVendor.size, vendors80: to80([...spendByVendor.values()].sort((a, b) => b - a)), top10SharePct: pct(sortedSpend.slice(0, 10).reduce((s, v) => s + v, 0), spendLast30) },
    bills: { count: bills.length, untaxedKwd: r3(bills.reduce((t, b) => t + billKwd(b), 0)), offPoCount: offPo.length, offPoKwd: r3(offPo.reduce((t, b) => t + billKwd(b), 0)) },
  }
  console.log(`■ Procurement × BOM Chain: ${pol.length} PO lines · ${billItemLines.length} bill lines · ${bomByTmpl.size} BOMs · spend30 ${procurement.spendLast30Kwd} · creep ${enrichedCreep.length} · multi-vendor ${enrichedVendorVariance.length}`)

  /* ─────────────────── stage 5/2/6 — Odoo 17 Analytic Cost Centers & Accounting ─────────────────── */
  const accounts = await safe('account.account search_read all', () => ek('account.account', 'search_read', [[]], { fields: ['id', 'code', 'name', 'account_type'] }), [])
  const accById = new Map(accounts.map((a) => [a.id, a]))
  const expenseTypes = ['expense', 'expense_direct_cost', 'expense_depreciation']

  // 1) Ingest account.analytic.plan & account.analytic.account (strictly whitelisted Venture Foods 6 brands + 7 branches + EXB + shared CK/HO only)
  const rawPlans = await safe('account.analytic.plan search_read', () => ek('account.analytic.plan', 'search_read', [[]], { fields: ['id', 'name', 'parent_id'] }), null)
  const whitelistedAnalyticMeta = new Map()
  for (const [locId, l] of Object.entries(REGISTRY.locations)) {
    if (l.unit === 'canteen') continue
    const ids = l.analyticIds ?? (l.analyticId ? [l.analyticId] : [])
    const kind = l.unit === 'restaurant' ? 'branch' : l.unit === 'exhibition' ? 'exb' : 'shared'
    for (const aid of ids) whitelistedAnalyticMeta.set(Number(aid), { analyticId: Number(aid), entityType: kind, entityId: locId, en: l.en, ar: l.ar, code: l.code })
  }
  const SHARED_LABELS = { 'central-kitchen': ['Ardiya Central Kitchen', 'المطبخ المركزي بالعارضية', 'CK'], 'head-office': ['Head Office', 'الإدارة العامة', 'HO'] }
  for (const [sid, aid] of Object.entries(REGISTRY.sharedCostAnalyticIds ?? {})) {
    const [en, ar, code] = SHARED_LABELS[sid] ?? [sid, sid, sid.toUpperCase()]
    whitelistedAnalyticMeta.set(Number(aid), { analyticId: Number(aid), entityType: 'shared', entityId: sid, en, ar, code })
  }
  for (const b of REGISTRY.brands) {
    if (b.analyticId && ACTIVE_BRAND_SET.has(b.id)) {
      whitelistedAnalyticMeta.set(Number(b.analyticId), { analyticId: Number(b.analyticId), entityType: 'brand', entityId: b.id, en: b.en, ar: b.ar, code: b.posRoot ?? b.id.toUpperCase() })
    }
  }
  const whitelistedIds = [...whitelistedAnalyticMeta.keys()].filter((id) => !EXCLUDED_ANALYTIC_SET.has(id))
  const rawAnalyticAccounts = await safe(
    'account.analytic.account search_read whitelisted',
    () => ek('account.analytic.account', 'search_read', [[['id', 'in', whitelistedIds]]], { fields: ['id', 'code', 'plan_id', 'active'], context: { active_test: false } }),
    null,
  )
  const rawAaById = new Map((rawAnalyticAccounts ?? []).map((a) => [a.id, a]))
  const analyticCenters = whitelistedIds.map((aid) => {
    const meta = whitelistedAnalyticMeta.get(aid)
    const row = rawAaById.get(aid)
    return { ...meta, planId: m2oId(row?.plan_id), planName: m2oName(row?.plan_id) ?? null, active: row?.active ?? true }
  })

  // 2) Posted company expense categories (rolling30, prior30, mtd)
  const postedByCat = async (w, label) => {
    const rows = await safe(`account.move.line read_group categories ${label}`, () => ek('account.move.line', 'read_group', [[['date', '>=', w.from], ['date', '<', w.to], ['parent_state', '=', 'posted'], ['account_id.account_type', 'in', expenseTypes]], ['balance:sum'], ['account_id']], { lazy: false }), [])
    const cats = {}; const commissions = {}
    let totalExpense = 0
    for (const g of rows) {
      const acc = accById.get(m2oId(g.account_id)); const cat = categoryOf(acc); const v = Number(g.balance) || 0
      totalExpense += v
      const c = (cats[cat] ||= { kwd: 0, postings: 0 }); c.kwd += v; c.postings += g.__count || 0
      if (cat === 'platform-commission') { const p = PLATFORM_OF(acc?.name); if (p) commissions[p] = (commissions[p] || 0) + v }
    }
    for (const c of Object.values(cats)) c.kwd = r3(c.kwd)
    return { totalExpenseKwd: r3(totalExpense), cats, commissions: Object.fromEntries(Object.entries(commissions).map(([k, v]) => [k, r3(v)])) }
  }
  const postedR = await postedByCat(R, 'rolling30'); const postedP = await postedByCat(P, 'prior30'); const postedM = await postedByCat(M, 'mtd')
  const opexCategories = Object.keys({ ...postedR.cats, ...postedP.cats }).map((cat) => {
    const r = postedR.cats[cat]?.kwd ?? 0; const p = postedP.cats[cat]?.kwd ?? 0; const m = postedM.cats[cat]?.kwd ?? 0
    return { category: cat, en: OPEX_CATEGORY_LABELS[cat]?.[0] ?? cat, ar: OPEX_CATEGORY_LABELS[cat]?.[1] ?? cat, rolling30Kwd: r3(r), prior30Kwd: r3(p), mtdKwd: r3(m), deltaKwd: r3(r - p), deltaPct: p ? r1(((r - p) / p) * 100) : null, postings: postedR.cats[cat]?.postings ?? 0 }
  }).sort((a, b) => b.rolling30Kwd - a.rolling30Kwd)

  // 3) Analytic ledger cube across ALL 3 windows (rolling30, prior30, mtd) from account.analytic.line
  const locAnalytic = {}
  for (const id of RESTAURANTS) { const l = REGISTRY.locations[id]; for (const a of l.analyticIds ?? (l.analyticId ? [l.analyticId] : [])) locAnalytic[a] = id }
  for (const [sid, aid] of Object.entries(REGISTRY.sharedCostAnalyticIds ?? {})) locAnalytic[aid] = sid
  for (const aid of REGISTRY.locations.exhibitions?.analyticIds ?? []) locAnalytic[aid] = 'exhibitions'
  if (REGISTRY.locations['call-center']?.analyticId) locAnalytic[REGISTRY.locations['call-center'].analyticId] = 'call-center'
  const brandAnalytic = Object.fromEntries(REGISTRY.brands.filter((b) => b.analyticId && ACTIVE_BRAND_SET.has(b.id)).map((b) => [b.analyticId, b.id]))

  let aalLineCountR30 = 0
  const analyticCube = async (w, label) => {
    const ids = [...new Set([...Object.keys(locAnalytic), ...Object.keys(brandAnalytic)].map(Number).filter((id) => !EXCLUDED_ANALYTIC_SET.has(id)))]
    const rows = await safe(`account.analytic.line read_group cube ${label}`, () => ek('account.analytic.line', 'read_group', [[['date', '>=', w.from], ['date', '<', w.to], ['account_id', 'in', ids]], ['amount:sum'], ['account_id', 'general_account_id']], { lazy: false }), null)
    if (!rows) return { ok: false, locations: {}, brands: {}, postings: 0 }
    const missing = [...new Set(rows.map((g) => m2oId(g.general_account_id)).filter((id) => id && !accById.has(id)))]
    if (missing.length) for (const a of await readMany('account.account read (cube)', 'account.account', missing, ['id', 'code', 'name', 'account_type'])) accById.set(a.id, a)
    const out = { ok: true, locations: {}, brands: {}, postings: 0 }
    for (const g of rows) {
      const aid = m2oId(g.account_id); const acc = accById.get(m2oId(g.general_account_id)); if (!acc) continue
      out.postings += g.__count || 0
      const target = locAnalytic[aid] ? (out.locations[locAnalytic[aid]] ||= {}) : brandAnalytic[aid] ? (out.brands[brandAnalytic[aid]] ||= {}) : null
      if (!target) continue
      const amount = Number(g.amount) || 0
      if (/^income/.test(acc.account_type || '')) { target.income = r3((target.income || 0) + amount); continue }
      if (!/^expense/.test(acc.account_type || '')) continue
      const cat = categoryOf(acc)
      target[cat] = r3((target[cat] || 0) - amount)
    }
    return out
  }
  const cubeR = await analyticCube(R, 'rolling30')
  const cubeP = await analyticCube(P, 'prior30')
  const cubeM = await analyticCube(M, 'mtd')
  aalLineCountR30 = cubeR.postings

  // 4) Off-PO Vendor Bills allocated per Analytic Cost Center (analytic_distribution on account.move.line)
  const offPoByLocation = {}; const offPoByBrand = {}
  if (offPo.length) {
    const offPoLines = await searchReadAll(
      'account.move.line search_read off-PO analytic',
      'account.move.line',
      [['move_id', 'in', offPo.map((b) => b.id)], ['account_id.account_type', 'in', expenseTypes]],
      ['account_id', 'balance', 'analytic_distribution'],
      2000,
    )
    for (const l of offPoLines) {
      const bal = Number(l.balance) || 0
      for (const [k, weight] of Object.entries(l.analytic_distribution || {})) {
        const aid = Number(k)
        if (EXCLUDED_ANALYTIC_SET.has(aid)) continue
        const alloc = bal * ((Number(weight) || 100) / 100)
        if (locAnalytic[aid]) offPoByLocation[locAnalytic[aid]] = r3((offPoByLocation[locAnalytic[aid]] || 0) + alloc)
        if (brandAnalytic[aid]) offPoByBrand[brandAnalytic[aid]] = r3((offPoByBrand[brandAnalytic[aid]] || 0) + alloc)
      }
    }
  }

  // 5) Unallocated Operational Expenses: posted account.move.line expense lines with empty/false analytic_distribution
  const scanUnallocated = async (w, label) => {
    const rows = await safe(
      `account.move.line read_group unallocated ${label}`,
      () => ek('account.move.line', 'read_group', [[['date', '>=', w.from], ['date', '<', w.to], ['parent_state', '=', 'posted'], ['account_id.account_type', 'in', expenseTypes], ['analytic_distribution', '=', false]], ['debit:sum', 'credit:sum', 'balance:sum'], ['account_id']], { lazy: false }),
      [],
    )
    let grossDebit = 0; let directOpex = 0; let stockVarianceContra = 0; let linesCount = 0
    const accountsList = []
    for (const g of rows) {
      const accId = m2oId(g.account_id)
      const acc = accById.get(accId)
      const cat = categoryOf(acc)
      const debit = Number(g.debit) || 0
      const credit = Number(g.credit) || 0
      const bal = Number(g.balance) || 0
      const cnt = g.__count || 0
      if (debit < 0.01 && credit < 0.01) continue
      linesCount += cnt
      grossDebit += debit
      if (cat === 'inventory-variance' && bal < 0) stockVarianceContra += Math.abs(bal)
      else if (bal > 0) directOpex += bal
      accountsList.push({
        accountId: accId,
        code: String(acc?.code ?? (codeOf(m2oName(g.account_id)) || '')),
        label: safeAccountLabel(acc?.name ?? m2oName(g.account_id)),
        category: cat,
        categoryEn: OPEX_CATEGORY_LABELS[cat]?.[0] ?? cat,
        categoryAr: OPEX_CATEGORY_LABELS[cat]?.[1] ?? cat,
        lines: cnt,
        debitKwd: r3(debit),
        creditKwd: r3(credit),
        netKwd: r3(bal),
      })
    }
    accountsList.sort((a, b) => b.debitKwd - a.debitKwd)
    return {
      lines: linesCount,
      grossDebitKwd: r3(grossDebit),
      directOpexKwd: r3(directOpex),
      stockVarianceContraKwd: r3(stockVarianceContra),
      accounts: accountsList.slice(0, 12),
    }
  }
  const unallocated = {
    rolling30: await scanUnallocated(R, 'rolling30'),
    prior30: await scanUnallocated(P, 'prior30'),
    mtd: await scanUnallocated(M, 'mtd'),
  }
  unallocated.rolling30.pctOfCompanyExpense = pct(unallocated.rolling30.grossDebitKwd, Math.max(1, postedR.totalExpenseKwd))

  // 6) Chronic maintenance loops directly from account.analytic.line (120 days; descriptions scanned in memory for equipment keywords only, never stored)
  const maintAccIds = accounts.filter((a) => /^expense/.test(a.account_type || '') && categoryOf(a) === 'maintenance').map((a) => a.id)
  const maintAnalyticIds = [...RESTAURANTS.map((id) => REGISTRY.locations[id]?.analyticId).filter(Boolean), REGISTRY.sharedCostAnalyticIds?.['central-kitchen']].filter(Boolean)
  const maintAalLines = maintAccIds.length && maintAnalyticIds.length
    ? await searchReadAll(
        'account.analytic.line search_read maintenance 120d',
        'account.analytic.line',
        [['date', '>=', win120], ['date', '<', R.to], ['account_id', 'in', maintAnalyticIds], ['general_account_id', 'in', maintAccIds]],
        ['account_id', 'plan_id', 'amount', 'date', 'general_account_id', 'product_id', 'move_line_id', 'name'],
        5000,
      )
    : []
  const PREPAID_CONTRACT_RE = /مصروفات مدفوعة مقدم|prepaid|عقد الصيانه السنوي/i
  const maint = {}
  for (const l of maintAalLines) {
    const aid = m2oId(l.account_id)
    const loc = locAnalytic[aid]
    if (!loc) continue
    const kwd = -(Number(l.amount) || 0)
    if (Math.abs(kwd) < 0.001) continue
    const text = `${l.name || ''} ${m2oName(l.product_id) || ''}`
    const isContract = PREPAID_CONTRACT_RE.test(text)
    const m = (maint[loc] ||= { analyticId: aid, postings120d: 0, kwd120d: 0, reactivePostings120d: 0, reactiveKwd120d: 0, months: new Set(), equipment: {} })
    m.postings120d++
    m.kwd120d += kwd
    m.months.add(String(l.date).slice(0, 7))
    if (!isContract) {
      m.reactivePostings120d++
      m.reactiveKwd120d += kwd
      const eq = EQUIPMENT.find(([, re]) => re.test(text))?.[0]
      if (eq && kwd > 0) { const e = (m.equipment[eq] ||= { postings: 0, kwd: 0 }); e.postings++; e.kwd += kwd }
    }
  }
  const maintenance = Object.entries(maint).map(([location, m]) => ({
    location,
    analyticId: m.analyticId,
    postings120d: m.postings120d,
    kwd120d: r3(m.kwd120d),
    reactivePostings120d: m.reactivePostings120d,
    reactiveKwd120d: r3(m.reactiveKwd120d),
    activeMonths: m.months.size,
    equipment: Object.entries(m.equipment).map(([key, e]) => ({ key, postings: e.postings, kwd: r3(e.kwd) })).sort((a, b) => b.kwd - a.kwd),
  })).sort((a, b) => b.reactiveKwd120d - a.reactiveKwd120d || b.kwd120d - a.kwd120d)

  // 7) Petty cash & custodies (branch cashier custodies named by whitelisted location only).
  const journals = await safe('account.journal search_read', () => ek('account.journal', 'search_read', [[['type', '=', 'cash']]], { fields: ['id', 'name', 'code'] }), [])
  const pettyJournals = journals.filter((j) => /petty cash|عهد/i.test(j.name || ''))
  const custodyOwner = (name) => { if (!/cashier|كاشير|branch|فرع/i.test(name || '')) return 'individual'; return locationOfName(name) ?? (EXB_PATTERN.test(name) ? 'exb' : 'other-branch') }
  const pettyRows = pettyJournals.length ? await safe('account.move.line read_group petty spend', () => ek('account.move.line', 'read_group', [[['date', '>=', R.from], ['date', '<', R.to], ['parent_state', '=', 'posted'], ['journal_id', 'in', pettyJournals.map((j) => j.id)], ['account_id.account_type', 'in', expenseTypes]], ['balance:sum'], ['journal_id', 'account_id']], { lazy: false }), []) : []
  const jName = new Map(pettyJournals.map((j) => [j.id, j.name]))
  const petty = { totalKwd: 0, byOwner: {}, byCategory: {}, outflowKwd: 0, outflowByOwner: {}, offPoByLocation, offPoByBrand }
  for (const g of pettyRows) {
    const owner = custodyOwner(jName.get(m2oId(g.journal_id))); const cat = categoryOf(accById.get(m2oId(g.account_id))); const v = Number(g.balance) || 0
    petty.totalKwd += v; petty.byOwner[owner] = (petty.byOwner[owner] || 0) + v; petty.byCategory[cat] = (petty.byCategory[cat] || 0) + v
  }
  const custodyAccounts = accounts.filter((a) => a.account_type === 'asset_cash' && /petty cash|عهد/i.test(a.name || ''))
  const outRows = custodyAccounts.length ? await safe('account.move.line read_group custody outflows', () => ek('account.move.line', 'read_group', [[['parent_state', '=', 'posted'], ['date', '>=', R.from], ['date', '<', R.to], ['account_id', 'in', custodyAccounts.map((a) => a.id)]], ['credit:sum', 'debit:sum'], ['account_id']], { lazy: false }), []) : []
  for (const g of outRows) { const owner = custodyOwner(accById.get(m2oId(g.account_id))?.name); const v = Number(g.credit) || 0; petty.outflowKwd += v; petty.outflowByOwner[owner] = (petty.outflowByOwner[owner] || 0) + v }
  const custodyRows = custodyAccounts.length ? await safe('account.move.line read_group custody balances', () => ek('account.move.line', 'read_group', [[['parent_state', '=', 'posted'], ['account_id', 'in', custodyAccounts.map((a) => a.id)]], ['balance:sum'], ['account_id']], { lazy: false }), []) : []
  const custody = { totalKwd: 0, branchCashier: {}, individualKwd: 0, individualAccounts: 0, otherKwd: 0 }
  for (const g of custodyRows) {
    const acc = accById.get(m2oId(g.account_id)); const v = Number(g.balance) || 0; if (Math.abs(v) < 0.5) continue
    const owner = custodyOwner(acc?.name); custody.totalKwd += v
    if (owner === 'individual') { custody.individualKwd += v; custody.individualAccounts++ } else if (REST_SET.has(owner)) custody.branchCashier[owner] = r3((custody.branchCashier[owner] || 0) + v)
    else custody.otherKwd += v
  }

  // Brand × location presence (host-kitchen planning) + location × channel mix (for exact branch net revenue post-commission).
  const brandLocation = (ctx.locBrandNet ? [...ctx.locBrandNet.entries()] : []).map(([k, v]) => { const [location, brand] = k.split('|'); return { location, brand, netKwd: r3(v) } }).filter((x) => REST_SET.has(x.location) && ACTIVE_BRAND_SET.has(x.brand) && x.netKwd > 0)
  const locationChannels = (ctx.locChannel ? [...ctx.locChannel.values()] : []).filter((c) => REST_SET.has(c.location)).map((c) => ({ location: c.location, channel: c.channel, amountKwd: r3(c.amountKwd), payments: c.payments }))

  // Aggregator clearing & receivables (stage 6).
  const clearingAcc = accounts.filter((a) => (a.account_type === 'asset_cash' && PLATFORM_OF(a.name) && !/petty/i.test(a.name)) || (a.account_type === 'asset_receivable' && PLATFORM_OF(a.name)))
  const clearAll = clearingAcc.length ? await safe('account.move.line read_group clearing balances', () => ek('account.move.line', 'read_group', [[['parent_state', '=', 'posted'], ['account_id', 'in', clearingAcc.map((a) => a.id)]], ['balance:sum'], ['account_id']], { lazy: false }), []) : []
  const clearWin = clearingAcc.length ? await safe('account.move.line read_group clearing window', () => ek('account.move.line', 'read_group', [[['parent_state', '=', 'posted'], ['date', '>=', R.from], ['date', '<', R.to], ['account_id', 'in', clearingAcc.map((a) => a.id)]], ['debit:sum', 'credit:sum'], ['account_id']], { lazy: false }), []) : []
  const platforms = {}
  for (const g of clearAll) { const acc = accById.get(m2oId(g.account_id)); const p = PLATFORM_OF(acc?.name); if (!p) continue; const x = (platforms[p] ||= { openBalanceKwd: 0, receivableKwd: 0, clearingKwd: 0, bookedKwd: 0, settledKwd: 0 }); x.openBalanceKwd += Number(g.balance) || 0; if (acc.account_type === 'asset_receivable') x.receivableKwd += Number(g.balance) || 0; else x.clearingKwd += Number(g.balance) || 0 }
  for (const g of clearWin) { const acc = accById.get(m2oId(g.account_id)); const p = PLATFORM_OF(acc?.name); if (!p || acc.account_type !== 'asset_cash') continue; const x = (platforms[p] ||= { openBalanceKwd: 0, receivableKwd: 0, clearingKwd: 0, bookedKwd: 0, settledKwd: 0 }); x.bookedKwd += Number(g.debit) || 0; x.settledKwd += Number(g.credit) || 0 }

  // Aggregator Forensics reconciliation (Tgo, TMP, Keeta, Deliveroo, Jahez, Snoonu)
  const CONTRACT_COMM = {
    'Talabat Go': { key: 'talabat-tgo', platform: 'Talabat', contractPct: 17.0 },
    'Talabat MP': { key: 'talabat-tmp', platform: 'Talabat', contractPct: 10.0 },
    Keeta: { key: 'keeta', platform: 'Keeta', contractPct: 12.0 },
    'Deliveroo Go': { key: 'deliveroo', platform: 'Deliveroo', contractPct: 18.0 },
    'Deliveroo MP': { key: 'deliveroo', platform: 'Deliveroo', contractPct: 18.0 },
    Jahez: { key: 'jahez', platform: 'Jahez', contractPct: 15.0 },
    Snoonu: { key: 'snoonu', platform: 'Snoonu', contractPct: 15.0 },
  }
  const forensicMap = new Map()
  for (const [chName, meta] of Object.entries(CONTRACT_COMM)) {
    const cur = forensicMap.get(meta.key) || { channel: meta.key, platform: meta.platform, contractPct: meta.contractPct, grossPos30Kwd: 0, netPos30Kwd: 0, promoBurn30Kwd: 0, payments30: 0 }
    cur.grossPos30Kwd += chGrossByName[chName] || 0
    cur.netPos30Kwd += chNetByName[chName] || 0
    cur.promoBurn30Kwd += chPromoByName[chName] || 0
    cur.payments30 += locationChannels.filter((lc) => lc.channel === chName.toLowerCase().replace(/\s+/g, '-') || (chName === 'Talabat Go' && lc.channel === 'talabat-tgo') || (chName === 'Talabat MP' && lc.channel === 'talabat-tmp') || (chName === 'Deliveroo Go' && lc.channel === 'deliveroo-go') || (chName === 'Deliveroo MP' && lc.channel === 'deliveroo-mp')).reduce((s, lc) => s + lc.payments, 0)
    forensicMap.set(meta.key, cur)
  }
  const delivery = {
    platforms: Object.entries(platforms).map(([platform, x]) => ({ platform, openBalanceKwd: r3(x.openBalanceKwd), receivableKwd: r3(x.receivableKwd), clearingKwd: r3(x.clearingKwd), booked30Kwd: r3(x.bookedKwd), settled30Kwd: r3(x.settledKwd), postedCommission30Kwd: postedR.commissions[platform] ?? 0 })).sort((a, b) => b.openBalanceKwd - a.openBalanceKwd),
    postedCommissions30: postedR.commissions, postedCommissionsPrior30: postedP.commissions,
    forensics: [...forensicMap.values()].map((f) => {
      const pRow = platforms[f.platform] || { openBalanceKwd: 0, clearingKwd: 0 }
      const contractCommKwd = r3(f.netPos30Kwd * (f.contractPct / 100))
      const promoBase = Math.max(f.grossPos30Kwd, f.netPos30Kwd + f.promoBurn30Kwd)
      return {
        channel: f.channel,
        platform: f.platform,
        contractPct: f.contractPct,
        grossPos30Kwd: r3(promoBase),
        netPos30Kwd: r3(f.netPos30Kwd),
        promoBurn30Kwd: r3(f.promoBurn30Kwd),
        promoBurnPct: pct(f.promoBurn30Kwd, promoBase),
        contractCommission30Kwd: contractCommKwd,
        postedCommission30Kwd: r3(postedR.commissions[f.platform] ?? 0),
        pendingReceivableKwd: r3(Math.max(0, pRow.openBalanceKwd || pRow.clearingKwd || 0)),
        payments30: f.payments30,
      }
    }),
  }

  /* stage 2 — central kitchen transfers, branch scrap & realistic 6% normal prep allowance vs abnormal shrinkage */
  const ckMoves = await safe('stock.move read_group CK transfers', () => ek('stock.move', 'read_group', [[['state', '=', 'done'], ['date', '>=', `${R.from} 00:00:00`], ['date', '<', `${R.to} 00:00:00`], ['location_id.complete_name', 'ilike', 'CK/Central Kitchen']], ['product_qty:sum'], ['location_dest_id']], { lazy: false }), [])
  const ckTransfers = {}
  for (const g of ckMoves) { const dest = m2oName(g.location_dest_id) || ''; const loc = locationOfName(dest) ?? (EXB_PATTERN.test(dest) ? 'exb' : null); if (!loc) continue; const c = (ckTransfers[loc] ||= { moves: 0 }); c.moves += g.__count || 0 }
  const scrapMoves = await searchReadAll('stock.move search_read branch scrap', 'stock.move', [['state', '=', 'done'], ['date', '>=', `${R.from} 00:00:00`], ['date', '<', `${R.to} 00:00:00`], ['location_dest_id.scrap_location', '=', true]], ['location_id', 'product_id', 'product_qty', 'price_unit'], 5000)
  const scrapByLoc = {}
  for (const m of scrapMoves) {
    const src = m2oName(m.location_id) || ''
    const loc = CK_PATTERN.test(src) ? 'central-kitchen' : locationOfName(src)
    if (!loc) continue
    const v = Math.abs(Number(m.price_unit) || 0) * (Number(m.product_qty) || 0)
    const s = (scrapByLoc[loc] ||= { moves: 0, valueKwd: 0, items: new Map() }); s.moves++; s.valueKwd += v
    const pid = m2oId(m.product_id); const it = s.items.get(pid) || { name: cleanName(m2oName(m.product_id)), qty: 0, valueKwd: 0 }; it.qty += Number(m.product_qty) || 0; it.valueKwd += v; s.items.set(pid, it)
  }

  // Separate normal 6.0% (5%-7% realistic allowance) cooking/prep trim & bulk oil/sauce stocktake adjustment from abnormal recoverable variance per branch
  const NORMAL_TRIM_ALLOWANCE_PCT = 6.0
  const branchShrinkage = RESTAURANTS.map((loc) => {
    const posSales = netByLoc[loc] || 0
    const ordersCnt = ordersByLoc[loc] || 0
    const r30 = cubeR.locations[loc] || {}
    const postedRaw = Math.max(0, Number(r30['raw-food']) || 0)
    const postedVar = Math.max(0, Number(r30['inventory-variance']) || 0)
    const postedScrap = Math.max(0, Number(r30.scrap) || (scrapByLoc[loc]?.valueKwd ?? 0))
    const ckMovesCnt = ckTransfers[loc]?.moves ?? 0
    const normalAllowanceKwd = r3(posSales * (NORMAL_TRIM_ALLOWANCE_PCT / 100))
    const abnormalVarianceKwd = r3(Math.max(0, postedVar - normalAllowanceKwd))
    return {
      location: loc,
      posNet30Kwd: r3(posSales),
      orders30: ordersCnt,
      ckTransferMoves30: ckMovesCnt,
      postedRawFood30Kwd: r3(postedRaw),
      postedVariance30Kwd: r3(postedVar),
      postedScrap30Kwd: r3(postedScrap),
      normalTrimAllowancePct: NORMAL_TRIM_ALLOWANCE_PCT,
      normalTrimAllowanceKwd: normalAllowanceKwd,
      abnormalVarianceKwd,
      abnormalPctOfSales: pct(abnormalVarianceKwd, posSales),
      recoverableConservative55Kwd: r3(abnormalVarianceKwd * 0.55),
      recoverableRealistic62Kwd: r3(abnormalVarianceKwd * 0.625),
      recoverableAmbitious70Kwd: r3(abnormalVarianceKwd * 0.70),
    }
  }).sort((a, b) => b.abnormalVarianceKwd - a.abnormalVarianceKwd)

  const kitchen = {
    posted30: { rawFoodKwd: postedR.cats['raw-food']?.kwd ?? 0, inventoryVarianceKwd: postedR.cats['inventory-variance']?.kwd ?? 0, scrapKwd: postedR.cats.scrap?.kwd ?? 0, packagingKwd: postedR.cats.packaging?.kwd ?? 0 },
    postedPrior30: { rawFoodKwd: postedP.cats['raw-food']?.kwd ?? 0, inventoryVarianceKwd: postedP.cats['inventory-variance']?.kwd ?? 0, scrapKwd: postedP.cats.scrap?.kwd ?? 0, packagingKwd: postedP.cats.packaging?.kwd ?? 0 },
    ckTransfers: Object.entries(ckTransfers).map(([location, c]) => ({ location, moves: c.moves, ordersPerMove: ordersByLoc[location] ? r1(ordersByLoc[location] / c.moves) : null })).sort((a, b) => b.moves - a.moves),
    scrap: Object.entries(scrapByLoc).map(([location, s]) => ({ location, moves: s.moves, valueKwd: r3(s.valueKwd), pctOfSales: netByLoc[location] ? pct(s.valueKwd, netByLoc[location]) : null, topItems: [...s.items.values()].sort((a, b) => b.valueKwd - a.valueKwd).slice(0, 5).map((i) => ({ ...i, qty: r3(i.qty), valueKwd: r3(i.valueKwd) })) })).sort((a, b) => b.valueKwd - a.valueKwd),
    branchShrinkage,
  }
  console.log(`■ Kitchen: food ${kitchen.posted30.rawFoodKwd} · variance ${kitchen.posted30.inventoryVarianceKwd} · abnormalShrinkage ${r3(branchShrinkage.reduce((s, b) => s + b.abnormalVarianceKwd, 0))} · scrap ${kitchen.posted30.scrapKwd}`)

  const analyticArchitecture = {
    plansReadable: Array.isArray(rawPlans),
    accountsReadable: Array.isArray(rawAnalyticAccounts),
    linesReadable: cubeR.ok,
    plans: (rawPlans ?? []).map((p) => ({ id: p.id, name: p.name })),
    whitelistedCenters: analyticCenters,
    rolling30Lines: aalLineCountR30,
  }

  // Analytic Cost Center × Branch Breakeven, Idle Kitchen Capacity & Repair-vs-Replace Triggers
  const COMM_BY_CH_CODE = { 'talabat-tgo': 0.17, 'talabat-tmp': 0.10, keeta: 0.12, 'deliveroo-go': 0.18, 'deliveroo-mp': 0.18, jahez: 0.15, snoonu: 0.15, cari: 0.15 }
  const branchEconomics = RESTAURANTS.map((loc) => {
    const posNet = netByLoc[loc] || 0
    const ordersCnt = ordersByLoc[loc] || 0
    const aov = ordersCnt > 0 ? posNet / ordersCnt : 5.0
    const r30 = cubeR.locations[loc] || {}
    const p30 = cubeP.locations[loc] || {}
    const rent = Math.max(0, Number(r30.rent) || Number(p30.rent) || 0)
    const payroll = Math.max(0, (Number(r30['staff-costs']) || 0) + (Number(r30['staff-housing']) || 0), (Number(p30['staff-costs']) || 0) + (Number(p30['staff-housing']) || 0))
    const utilities = Math.max(0, Number(r30.utilities) || Number(p30.utilities) || 0)
    const cleaning = Math.max(0, Number(r30.cleaning) || 0)
    const maintKwd = Math.max(0, Number(r30.maintenance) || 0)
    const fixedMonthlyKwd = r3(rent + payroll + utilities + cleaning + maintKwd)
    const foodUsage = Math.max(0, (Number(r30['raw-food']) || 0) + (Number(r30['inventory-variance']) || 0) + (Number(r30.scrap) || 0) + (Number(r30.packaging) || 0))
    const foodPct = posNet > 0 ? Math.min(0.45, Math.max(0.22, foodUsage / posNet)) : 0.28
    const lChs = locationChannels.filter((c) => c.location === loc)
    const commKwd = lChs.reduce((s, c) => s + c.amountKwd * (COMM_BY_CH_CODE[c.channel] ?? 0), 0)
    const commPct = posNet > 0 ? Math.min(0.18, commKwd / posNet) : 0.09
    const cmRatio = Math.max(0.25, 1 - foodPct - commPct)
    const monthlyBreakevenSalesKwd = r3(fixedMonthlyKwd / cmRatio)
    const dailyBreakevenSalesKwd = r3(monthlyBreakevenSalesKwd / Math.max(1, R.days))
    const dailyBreakevenOrders = Math.ceil(dailyBreakevenSalesKwd / Math.max(1, aov))
    const opLoc = operations.locations.find((o) => o.location === loc)
    const activeBrandsAtLoc = new Set(brandLocation.filter((bl) => bl.location === loc && bl.netKwd >= 100).map((bl) => bl.brand))
    const eligibleZeroRentBrands = ACTIVE_BRAND_IDS.filter((bid) => !activeBrandsAtLoc.has(bid))
    const mRow = maintenance.find((m) => m.location === loc)
    return {
      location: loc,
      posNet30Kwd: r3(posNet),
      orders30: ordersCnt,
      rentKwd: r3(rent),
      payrollKwd: r3(payroll),
      utilitiesAndCleaningKwd: r3(utilities + cleaning),
      fixedMonthlyKwd,
      contributionMarginPct: r1(cmRatio * 100),
      monthlyBreakevenSalesKwd,
      dailyBreakevenSalesKwd,
      dailyBreakevenOrders,
      surplusAboveBreakevenKwd: r3(posNet - monthlyBreakevenSalesKwd),
      idleAfternoonCapacityPct: opLoc?.idleAfternoonCapacityPct ?? 45,
      eligibleZeroRentBrands,
      reactiveMaint120dKwd: mRow?.reactiveKwd120d ?? 0,
      reactiveMaint120dPostings: mRow?.reactivePostings120d ?? 0,
      repairVsReplaceTrigger: Boolean(mRow && (mRow.reactivePostings120d >= 4 || mRow.reactiveKwd120d >= 300)),
    }
  })

  const opex = {
    analyticArchitecture,
    unallocated,
    categories: opexCategories,
    branchEconomics,
    locations: RESTAURANTS.map((location) => ({
      location,
      analyticId: REGISTRY.locations[location]?.analyticId ?? null,
      rolling30: cubeR.locations[location] ?? {},
      prior30: cubeP.locations[location] ?? {},
      mtd: cubeM.locations[location] ?? {},
      offPo30Kwd: offPoByLocation[location] ?? 0,
    })),
    centralKitchen: {
      analyticId: REGISTRY.sharedCostAnalyticIds?.['central-kitchen'] ?? 17,
      rolling30: cubeR.locations['central-kitchen'] ?? {},
      prior30: cubeP.locations['central-kitchen'] ?? {},
      mtd: cubeM.locations['central-kitchen'] ?? {},
    },
    headOffice: {
      analyticId: REGISTRY.sharedCostAnalyticIds?.['head-office'] ?? 19,
      rolling30: cubeR.locations['head-office'] ?? {},
      prior30: cubeP.locations['head-office'] ?? {},
      mtd: cubeM.locations['head-office'] ?? {},
      offPo30Kwd: offPoByLocation['head-office'] ?? 0,
    },
    exhibitions: {
      analyticIds: REGISTRY.locations.exhibitions?.analyticIds ?? [],
      rolling30: cubeR.locations.exhibitions ?? {},
      prior30: cubeP.locations.exhibitions ?? {},
      mtd: cubeM.locations.exhibitions ?? {},
    },
    brands: REGISTRY.brands.filter((b) => ACTIVE_BRAND_SET.has(b.id)).map((b) => ({
      brand: b.id,
      analyticId: b.analyticId ?? null,
      rolling30: cubeR.brands[b.id] ?? {},
      prior30: cubeP.brands[b.id] ?? {},
      mtd: cubeM.brands[b.id] ?? {},
      offPo30Kwd: offPoByBrand[b.id] ?? 0,
    })).filter((b) => Object.keys(b.rolling30).length > 0 || Object.keys(b.prior30).length > 0 || Object.keys(b.mtd).length > 0),
    maintenance,
    petty: {
      totalKwd: r3(petty.totalKwd),
      byOwner: Object.fromEntries(Object.entries(petty.byOwner).map(([k, v]) => [k, r3(v)])),
      byCategory: Object.fromEntries(Object.entries(petty.byCategory).map(([k, v]) => [k, r3(v)])),
      outflowKwd: r3(petty.outflowKwd),
      outflowByOwner: Object.fromEntries(Object.entries(petty.outflowByOwner).map(([k, v]) => [k, r3(v)])),
      offPoByLocation,
      offPoByBrand,
    },
    custody: { ...custody, totalKwd: r3(custody.totalKwd), individualKwd: r3(custody.individualKwd), otherKwd: r3(custody.otherKwd) },
  }
  console.log(`■ OpEx & Analytic Cost Centers: ${analyticCenters.length} whitelisted centers · ${opexCategories.length} categories · unallocated debit30 ${unallocated.rolling30.grossDebitKwd} KWD (${unallocated.rolling30.lines} lines) · maintenance sites ${maintenance.length} · custody open ${opex.custody.totalKwd}`)

  return {
    journey: { windows: WINDOWS, access, pulse, procurement, kitchen, menu, operations, opex, delivery, quality, brandLocation, locationChannels, issues },
    locDishQty,
  }
}
