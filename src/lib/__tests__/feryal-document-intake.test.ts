import { readFileSync } from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { DELETE, GET, PATCH, POST, PUT } from '@/app/api/erp/feryal/document-intake/route'
import { createExecSessionToken, EXEC_SESSION_COOKIE } from '@/lib/auth/exec-session'
import {
  detectIntakeFileKind,
  DocumentIntakeError,
  extractVisionIntakeRows,
  ingestPricingDocument,
  MAX_DOCUMENT_INTAKE_BYTES,
  parseSpreadsheetIntakeRows,
} from '@/lib/feryal/document-intake'
import {
  confirmDocumentIntakeDraft,
  EXTRACTED_DRAFT_UNCONFIRMED_LABEL,
  isConfirmedPriceSheet,
  isNonStandardKwdFils,
  isUnconfirmedDocumentDraft,
  recomputeDocumentIntakeDraft,
  recomputeIntakeRowAnomalies,
  USER_INPUT_CONFIRMED_LABEL,
} from '@/lib/feryal/document-intake-types'
import type { ItemPricingRow } from '@/lib/feryal/item-pricing'

const SAMPLE_ODOO_ROWS: readonly ItemPricingRow[] = [
  {
    productId: 101,
    name: '[CG-01] Sweet & Sour Chicken',
    qty: '420',
    netKwd: '630.000',
    unitPriceKwd: '1.500',
    categoryId: 10,
  },
  {
    productId: 102,
    name: 'Vegetable Spring Roll',
    qty: '800',
    netKwd: '1000.000',
    unitPriceKwd: '1.250',
    categoryId: 10,
  },
  {
    productId: 103,
    name: 'Beef Chow Mein',
    qty: '300',
    netKwd: '675.000',
    unitPriceKwd: '2.250',
    categoryId: 11,
  },
  {
    productId: 104,
    name: 'سبرينج رول خضار',
    qty: '150',
    netKwd: '187.500',
    unitPriceKwd: '1.250',
    categoryId: 10,
  },
  {
    productId: 999,
    name: 'Heisenberg Special Box',
    qty: '50',
    netKwd: '250.000',
    unitPriceKwd: '5.000',
    categoryId: 150,
  },
]

function buildXlsxBytes(aoa: unknown[][]): Uint8Array<ArrayBuffer> {
  const sheet = XLSX.utils.aoa_to_sheet(aoa)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Pricing Proposal')
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  const copy = new ArrayBuffer(buffer.byteLength)
  const view = new Uint8Array(copy)
  view.set(buffer)
  return view
}

describe('document-intake client boundary & Kuwaiti fils validation', () => {
  it('keeps document-intake-types.ts free of server-only and node imports for client components', () => {
    const filePath = path.resolve(process.cwd(), 'src/lib/feryal/document-intake-types.ts')
    const source = readFileSync(filePath, 'utf8')
    expect(source).not.toContain('server-only')
    expect(source).not.toMatch(/from ['"]node:/)
  })

  it('detects allowed file extensions and rejects unsupported formats', () => {
    expect(detectIntakeFileKind('menu.xlsx', '')?.fileKind).toBe('xlsx')
    expect(detectIntakeFileKind('menu.csv', 'text/csv')?.fileKind).toBe('csv')
    expect(detectIntakeFileKind('photo.jpg', 'image/jpeg')?.fileKind).toBe('image')
    expect(detectIntakeFileKind('photo.jpeg', '')?.fileKind).toBe('image')
    expect(detectIntakeFileKind('scan.png', 'image/png')?.fileKind).toBe('image')
    expect(detectIntakeFileKind('scan.webp', 'image/webp')?.fileKind).toBe('image')
    expect(detectIntakeFileKind('report.pdf', 'application/pdf')).toBeNull()
    expect(detectIntakeFileKind('script.exe', 'application/octet-stream')).toBeNull()
    expect(detectIntakeFileKind('fake.xlsx', 'image/png')).toBeNull()
  })

  it('flags >3 decimal places and non-5-fils thousandths while allowing standard KWD prices', () => {
    expect(isNonStandardKwdFils('1.5')).toBe(false)
    expect(isNonStandardKwdFils('1.25')).toBe(false)
    expect(isNonStandardKwdFils('1.500')).toBe(false)
    expect(isNonStandardKwdFils('1.425')).toBe(false)
    expect(isNonStandardKwdFils('2')).toBe(false)

    expect(isNonStandardKwdFils('1.2345')).toBe(true)
    expect(isNonStandardKwdFils('1.5000')).toBe(true)
    expect(isNonStandardKwdFils('1.423')).toBe(true)
    expect(isNonStandardKwdFils('1.237')).toBe(true)
    expect(isNonStandardKwdFils('0.999')).toBe(true)
  })
})

describe('deterministic Excel (.xlsx) and CSV extraction with multi-option columns', () => {
  it('parses binary .xlsx workbooks with title rows and multiple proposed columns (CH vs AE)', async () => {
    const xlsxBytes = buildXlsxBytes([
      ['Venture Foods Kuwait — Q4 Menu Pricing Review'],
      [],
      ['Brand', 'Item Name', 'Current Price', 'CH', 'AE', 'Notes'],
      ['China Garden', 'Sweet & Sour Chicken', '1.500', '1.650', '1.750', 'Core hero dish'],
      ['China Garden', 'Vegetable Spring Roll', '1.250', '1.350', '1.400', 'Appetizer'],
      ['Total', '', '', '', '', ''],
    ])

    const draft = await ingestPricingDocument(
      {
        fileName: 'cg-q4-pricing.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        bytes: xlsxBytes,
        period: 'month',
        brand: 'china-garden',
      },
      {
        draftId: 'draft_xlsx_1',
        referenceNowMs: Date.UTC(2026, 10, 19, 12, 0, 0),
        odooRowsOverride: SAMPLE_ODOO_ROWS,
      },
    )

    expect(draft.sourceTag).toBe(EXTRACTED_DRAFT_UNCONFIRMED_LABEL)
    expect(draft.requiresHumanConfirmation).toBe(true)
    expect(draft.fileKind).toBe('xlsx')
    expect(draft.brand).toBe('china-garden')
    expect(draft.period).toEqual({ from: '2026-11-01', to: '2026-11-19' })
    expect(draft.rows).toHaveLength(2)

    const first = draft.rows[0]
    expect(first?.itemName).toBe('Sweet & Sour Chicken')
    expect(first?.matchedOdooProductId).toBe(101)
    expect(first?.odooRealizedUnitPriceKwd).toBe('1.500')
    expect(first?.proposedOptions).toEqual([
      { optionKey: 'ch', label: 'CH', proposedPriceKwd: '1.650' },
      { optionKey: 'ae', label: 'AE', proposedPriceKwd: '1.750' },
    ])
    expect(first?.anomalies).toEqual([])
    expect(draft.summary).toEqual({
      totalRows: 2,
      matchedRows: 2,
      criticalCount: 0,
      warningCount: 0,
    })
  })

  it('parses UTF-8 .csv files with CH vs AE columns and Arabic headers cleanly', () => {
    const enCsv = [
      'Brand,Product,Current,CH,AE',
      'China Garden,Sweet & Sour Chicken,1.500,1.600,1.700',
      'China Garden,Beef Chow Mein,2.250,2.400,2.500',
    ].join('\n')
    const enRows = parseSpreadsheetIntakeRows(new TextEncoder().encode(enCsv))
    expect(enRows).toHaveLength(2)
    expect(enRows[0]?.proposedOptions.map((o) => o.optionKey)).toEqual(['ch', 'ae'])
    expect(enRows[1]?.sheetCurrentPriceKwd).toBe('2.250')

    const arCsv = [
      'العلامة,الصنف,السعر الحالي,مقترح أ,مقترح ب',
      'تشاينا جاردن,سبرينج رول خضار,1.250,1.350,1.450',
    ].join('\n')
    const arRows = parseSpreadsheetIntakeRows(new TextEncoder().encode(arCsv))
    expect(arRows).toHaveLength(1)
    expect(arRows[0]?.brand).toBe('تشاينا جاردن')
    expect(arRows[0]?.itemName).toBe('سبرينج رول خضار')
    expect(arRows[0]?.proposedOptions).toHaveLength(2)
    expect(arRows[0]?.proposedOptions[0]?.proposedPriceKwd).toBe('1.350')
  })
})

describe('vision image extraction with strict Zod schema & unconfirmed draft tagging', () => {
  it('extracts rows from an image via Gemini inline_data and enforces Extracted Draft (Unconfirmed)', async () => {
    let capturedUrl = ''
    let capturedBody = ''
    const mockFetch: typeof fetch = async (input, init) => {
      capturedUrl = String(input)
      capturedBody = typeof init?.body === 'string' ? init.body : ''
      return new Response(
        JSON.stringify({
          modelVersion: 'gemini-3.1-pro-preview',
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      rows: [
                        {
                          brand: 'China Garden',
                          item_name: 'Sweet & Sour Chicken',
                          current_price: '1.500',
                          proposed_options: [
                            { option_key: 'ch', label: 'CH', proposed_price: '0.400' },
                            { option_key: 'ae', label: 'AE', proposed_price: '1.650' },
                          ],
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }

    const fakeImage = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const draft = await ingestPricingDocument(
      {
        fileName: 'whatsapp-menu-photo.png',
        mimeType: 'image/png',
        bytes: fakeImage,
        period: 'month',
      },
      {
        fetchImpl: mockFetch,
        keys: {
          google: 'AIzaSyFakeTestKeyWithAtLeastTwentyChars123',
          anthropic: '',
          xai: '',
        },
        odooRowsOverride: SAMPLE_ODOO_ROWS,
      },
    )

    expect(capturedUrl).toContain('generativelanguage.googleapis.com')
    expect(capturedBody).toContain('inline_data')
    expect(draft.fileKind).toBe('image')
    expect(draft.sourceTag).toBe('Extracted Draft (Unconfirmed)')
    expect(draft.requiresHumanConfirmation).toBe(true)
    expect(draft.rows[0]?.anomalies.map((a) => a.code)).toContain('SUSPICIOUS_DROP_GT_30PCT')
  })

  it('falls back to Anthropic Claude vision when Gemini fails and rejects invalid JSON schemas', async () => {
    const calls: string[] = []
    const fallbackFetch: typeof fetch = async (input) => {
      const url = String(input)
      calls.push(url)
      if (url.includes('googleapis.com')) {
        return new Response('rate limit', { status: 429 })
      }
      return new Response(
        JSON.stringify({
          model: 'claude-sonnet-4-6',
          content: [
            {
              type: 'text',
              text: '```json\n{"rows":[{"brand":"China Garden","item_name":"Beef Chow Mein","current_price":"2.250","proposed_options":[{"label":"Proposed","proposed_price":"2.500"}]}]}\n```',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }

    const rows = await extractVisionIntakeRows(
      {
        bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
        mimeType: 'image/jpeg',
        fileName: 'sheet.jpg',
      },
      {
        fetchImpl: fallbackFetch,
        keys: {
          google: 'AIzaSyFakeTestKeyWithAtLeastTwentyChars123',
          anthropic: 'sk-ant-fake-key-with-at-least-twenty-chars-123',
          xai: '',
        },
      },
    )

    expect(calls).toHaveLength(2)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.itemName).toBe('Beef Chow Mein')

    await expect(
      extractVisionIntakeRows(
        {
          bytes: new Uint8Array([1, 2, 3]),
          mimeType: 'image/webp',
          fileName: 'bad.webp',
        },
        {
          visionExtractOverride: async () => ({ unexpected: true }),
        },
      ),
    ).rejects.toMatchObject({ code: 'VISION_INVALID_SCHEMA' })
  })
})

describe('deterministic anomaly & typo guard, live inline edit recomputation, and confirmation gate', () => {
  it('flags all 7 anomaly codes deterministically and never matches excluded entities', async () => {
    const csv = [
      'Brand,Item,Current,CH,AE',
      // Row 1: 0.400 vs 1.500 (>30% drop typo) + 2.550 vs 1.500 (+70% jump >60% warning)
      'China Garden,Sweet & Sour Chicken,1.500,0.400,2.550',
      // Row 2: 0.150 vs 1.250 (low price < 0.250 vs >= 0.750 ref + >30% drop) + 3.000 (+140% >100% critical jump)
      'China Garden,Vegetable Spring Roll,1.250,0.150,3.000',
      // Row 3: non-standard KWD fils (1.423 non-5-fils & 1.2345 >3dp)
      'China Garden,Beef Chow Mein,2.250,1.423,1.2345',
      // Row 4: duplicate SKU of Row 3 + missing/invalid price
      'China Garden,Beef Chow Mein,2.250,,abc',
      // Row 5: unmatched SKU
      'China Garden,Dragon Lobster Platter,4.500,4.750,5.000',
      // Row 6: excluded entity Heisenberg must NOT match Odoo row 999 -> flagged UNMATCHED_ODOO_SKU
      'China Garden,Heisenberg Special Box,5.000,5.250,5.500',
    ].join('\n')

    const draft = await ingestPricingDocument(
      {
        fileName: 'anomalies.csv',
        mimeType: 'text/csv',
        bytes: new TextEncoder().encode(csv),
        period: 'month',
      },
      {
        odooRowsOverride: SAMPLE_ODOO_ROWS,
      },
    )

    const r1 = draft.rows[0]
    expect(r1?.anomalies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'SUSPICIOUS_DROP_GT_30PCT',
          severity: 'critical',
          optionKey: 'ch',
          referenceOdooPriceKwd: '1.500',
          pctChange: '-73.33',
        }),
        expect.objectContaining({
          code: 'EXTREME_JUMP_GT_60PCT',
          severity: 'warning',
          optionKey: 'ae',
          pctChange: '70',
        }),
      ]),
    )

    const r2 = draft.rows[1]
    expect(r2?.anomalies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'SUSPICIOUS_LOW_PRICE',
          severity: 'critical',
          optionKey: 'ch',
        }),
        expect.objectContaining({
          code: 'EXTREME_JUMP_GT_60PCT',
          severity: 'critical',
          optionKey: 'ae',
          pctChange: '140',
        }),
      ]),
    )

    const r3 = draft.rows[2]
    expect(r3?.anomalies.map((a) => a.code)).toEqual(
      expect.arrayContaining(['NON_STANDARD_KWD_FILS', 'DUPLICATE_SKU']),
    )

    const r4 = draft.rows[3]
    expect(r4?.anomalies.map((a) => a.code)).toEqual(
      expect.arrayContaining(['MISSING_OR_INVALID_PRICE', 'DUPLICATE_SKU']),
    )

    const r5 = draft.rows[4]
    expect(r5?.matchedOdooProductId).toBeNull()
    expect(r5?.anomalies.map((a) => a.code)).toContain('UNMATCHED_ODOO_SKU')

    const r6 = draft.rows[5]
    expect(r6?.matchedOdooProductId).toBeNull()
    expect(r6?.anomalies.map((a) => a.code)).toContain('UNMATCHED_ODOO_SKU')
  })

  it('clears typo and duplicate flags when edited inline and produces User Input (Confirmed) dropping excluded rows', async () => {
    const csv = [
      'Brand,Item,Current,Proposed',
      'China Garden,Sweet & Sour Chicken,1.500,0.400',
      'China Garden,Sweet & Sour Chicken,1.500,0.400',
    ].join('\n')

    const initialDraft = await ingestPricingDocument(
      {
        fileName: 'typo-review.csv',
        mimeType: 'text/csv',
        bytes: new TextEncoder().encode(csv),
      },
      { odooRowsOverride: SAMPLE_ODOO_ROWS },
    )

    expect(isUnconfirmedDocumentDraft(initialDraft)).toBe(true)
    expect(isConfirmedPriceSheet(initialDraft)).toBe(false)
    expect(initialDraft.summary.criticalCount).toBe(2)
    expect(initialDraft.rows[0]?.anomalies.map((a) => a.code)).toEqual(
      expect.arrayContaining(['SUSPICIOUS_DROP_GT_30PCT', 'DUPLICATE_SKU']),
    )

    // User fixes Row 1 price typo (0.400 -> 1.650) and excludes duplicate Row 2
    const editedRows = recomputeIntakeRowAnomalies([
      {
        ...initialDraft.rows[0]!,
        proposedOptions: [{ optionKey: 'proposed', label: 'Proposed', proposedPriceKwd: '1.65' }],
      },
      {
        ...initialDraft.rows[1]!,
        excluded: true,
      },
    ])

    expect(editedRows[0]?.anomalies).toEqual([])

    const updatedDraft = recomputeDocumentIntakeDraft({
      ...initialDraft,
      rows: editedRows,
    })
    expect(updatedDraft.summary.criticalCount).toBe(0)
    expect(updatedDraft.summary.warningCount).toBe(0)
    expect(updatedDraft.summary.matchedRows).toBe(1)

    const confirmed = confirmDocumentIntakeDraft(updatedDraft, '2026-11-19T15:30:00.000Z')
    expect(confirmed.sourceTag).toBe(USER_INPUT_CONFIRMED_LABEL)
    expect(isConfirmedPriceSheet(confirmed)).toBe(true)
    expect(isUnconfirmedDocumentDraft(confirmed)).toBe(false)
    expect(confirmed.rows).toHaveLength(1)
    expect(confirmed.rows[0]).toEqual({
      rowId: 'row_1',
      brand: 'China Garden',
      itemName: 'Sweet & Sour Chicken',
      currentPriceKwd: '1.500',
      proposedOptions: [{ optionKey: 'proposed', label: 'Proposed', proposedPriceKwd: '1.650' }],
      matchedOdooProductId: 101,
    })
  })
})

describe('/api/erp/feryal/document-intake route handler', () => {
  it('returns 405 on GET, PUT, PATCH, DELETE', async () => {
    expect((await GET()).status).toBe(405)
    expect((await PUT()).status).toBe(405)
    expect((await PATCH()).status).toBe(405)
    expect((await DELETE()).status).toBe(405)
  })

  it('enforces executive session authentication (401 unauthenticated, 403 read-only auditor)', async () => {
    const form = new FormData()
    form.append('file', new File(['Item,Proposed\nSpring Roll,1.500'], 'menu.csv', { type: 'text/csv' }))

    const unauthReq = new NextRequest('http://localhost/api/erp/feryal/document-intake', {
      method: 'POST',
      body: form,
    })
    const unauthRes = await POST(unauthReq)
    expect(unauthRes.status).toBe(401)

    const auditorToken = await createExecSessionToken('auditor@venturefoodskw.com', 'auditor')
    const auditorForm = new FormData()
    auditorForm.append(
      'file',
      new File(['Item,Proposed\nSpring Roll,1.500'], 'menu.csv', { type: 'text/csv' }),
    )
    const auditorReq = new NextRequest('http://localhost/api/erp/feryal/document-intake', {
      method: 'POST',
      headers: { cookie: `${EXEC_SESSION_COOKIE}=${auditorToken}` },
      body: auditorForm,
    })
    const auditorRes = await POST(auditorReq)
    expect(auditorRes.status).toBe(403)
  })

  it('rejects unsupported file extensions (415) and oversized uploads > 10MB (413)', async () => {
    const gmToken = await createExecSessionToken('gm@venturefoodskw.com', 'gm')
    const cookieHeader = `${EXEC_SESSION_COOKIE}=${gmToken}`

    const pdfForm = new FormData()
    pdfForm.append('file', new File(['%PDF-1.4'], 'menu.pdf', { type: 'application/pdf' }))
    const pdfRes = await POST(
      new NextRequest('http://localhost/api/erp/feryal/document-intake', {
        method: 'POST',
        headers: { cookie: cookieHeader },
        body: pdfForm,
      }),
    )
    expect(pdfRes.status).toBe(415)

    const oversizedBytes = new Uint8Array(MAX_DOCUMENT_INTAKE_BYTES + 1)
    await expect(
      ingestPricingDocument({
        fileName: 'huge.csv',
        mimeType: 'text/csv',
        bytes: oversizedBytes,
      }),
    ).rejects.toBeInstanceOf(DocumentIntakeError)
  })

  it('accepts authenticated multipart .xlsx upload and returns Extracted Draft (Unconfirmed)', async () => {
    const gmToken = await createExecSessionToken('gm@venturefoodskw.com', 'gm')
    const xlsxBytes = buildXlsxBytes([
      ['Brand', 'Item', 'Current', 'CH', 'AE'],
      ['China Garden', 'Sweet & Sour Chicken', '1.500', '1.650', '1.750'],
    ])

    const form = new FormData()
    form.append(
      'file',
      new File([xlsxBytes], 'cg-proposal.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    )
    form.append('period', 'month')
    form.append('brand', 'china-garden')

    const req = new NextRequest('http://localhost/api/erp/feryal/document-intake', {
      method: 'POST',
      headers: { cookie: `${EXEC_SESSION_COOKIE}=${gmToken}` },
      body: form,
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      ok: boolean
      draft: {
        sourceTag: string
        requiresHumanConfirmation: boolean
        rows: Array<{ itemName: string; proposedOptions: Array<{ optionKey: string }> }>
      }
    }
    expect(body.ok).toBe(true)
    expect(body.draft.sourceTag).toBe('Extracted Draft (Unconfirmed)')
    expect(body.draft.requiresHumanConfirmation).toBe(true)
    expect(body.draft.rows).toHaveLength(1)
    expect(body.draft.rows[0]?.itemName).toBe('Sweet & Sour Chicken')
    expect(body.draft.rows[0]?.proposedOptions.map((o) => o.optionKey)).toEqual(['ch', 'ae'])
  })
})
