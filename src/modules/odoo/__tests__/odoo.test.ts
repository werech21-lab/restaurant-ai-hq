import { deflateRawSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { permissions } from '@/lib/auth/permissions'
import { parseDelimited } from '@/modules/odoo/domain/csv'
import { detectModel, kwdToFils, planApply, plainValue } from '@/modules/odoo/domain/odoo'
import { fetchOdooModels, type OdooTransport } from '@/modules/odoo/domain/rpc'
import { readXlsxRows } from '@/modules/odoo/domain/sheet'

const owner = new Set<string>([permissions.crmCustomerCreate, permissions.hrEmployeeManage, permissions.inventoryItemCreate])

describe('Odoo import rules', () => {
  it('converts KWD decimals to fils and refuses negatives', () => {
    expect(kwdToFils('1.250')).toBe(1250)
    expect(kwdToFils(0)).toBe(0)
    expect(kwdToFils('0.5')).toBe(500)
    expect(kwdToFils('-1')).toBeNull()
    expect(kwdToFils('nope')).toBeNull()
  })

  it('keeps ledgers and stock staged, and writes a named contact when the permission is present', () => {
    expect(planApply('account.move', { name: 'INV/1' }, owner).reason).toBe('ledger')
    expect(planApply('stock.quant', { quantity: 3 }, owner).reason).toBe('stock')
    expect(planApply('hr.payslip', { name: 'May' }, owner).reason).toBe('payroll')
    expect(planApply('res.partner', { name: 'فارم' }, owner)).toEqual({ status: 'applied', target: 'customers', reason: null })
    expect(planApply('res.partner', { name: 'فارم' }, new Set()).reason).toBe('permission')
    expect(planApply('res.partner', { name: '  ' }, owner).status).toBe('skipped')
    expect(planApply('product.template', { name: 'صوص', list_price: -1, standard_price: 0 }, owner).status).toBe('skipped')
  })

  it('recognizes an employee export and a quoted csv row', () => {
    expect(detectModel(['Name', 'Work Email'])).toBe('hr.employee')
    expect(detectModel(['name', 'quantity', 'location_id'])).toBe('stock.quant')
    expect(parseDelimited('name,phone\n"Al, Noor","+965 123"')).toEqual([['name', 'phone'], ['Al, Noor', '+965 123']])
    expect(plainValue([14, 'المطبخ'])).toBe('المطبخ')
  })

  it('authenticates once and does not follow another host', async () => {
    const calls: string[] = []
    const transport: OdooTransport = async (url, body) => {
      calls.push(url)
      const params = (body as { params: { method: string; args: unknown[] } }).params
      if (params.method === 'authenticate') return { result: 7 }
      return { result: [{ id: 3, name: 'شاورما طحينة', email: 'a@venturefoods.example' }] }
    }
    const pulled = await fetchOdooModels(transport, 'venture', 'owner@venturefoods.example', 'not-stored', ['res.partner'])
    expect(calls).toEqual(['https://venturefoods.walnutss.com/jsonrpc', 'https://venturefoods.walnutss.com/jsonrpc'])
    expect(pulled[0]?.rows[0]?.name).toBe('شاورما طحينة')
  })

  it('reads a stored and a deflated worksheet', () => {
    const shared = Buffer.from('<?xml version="1.0"?><sst><si><t>name</t></si><si><t>email</t></si><si><t>Farm</t></si></sst>')
    const sheet = Buffer.from('<?xml version="1.0"?><worksheet><sheetData><row><c t="s"><v>0</v></c><c t="s"><v>1</v></c></row><row><c t="s"><v>2</v></c><c t="inlineStr"><is><t>a@b.co</t></is></c></row></sheetData></worksheet>')
    const bytes = zipStored([
      ['xl/sharedStrings.xml', shared],
      ['xl/worksheets/sheet1.xml', deflateRawSync(sheet), 8, sheet.length],
    ])
    expect(readXlsxRows(bytes)).toEqual([['name', 'email'], ['Farm', 'a@b.co']])
  })
})

function zipStored(files: (readonly [string, Buffer] | readonly [string, Buffer, 8, number])[]): Uint8Array {
  const parts: Buffer[] = []
  for (const file of files) {
    const name = Buffer.from(file[0])
    const data = file[1]
    const method = file[2] ?? 0
    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50, 0)
    header.writeUInt16LE(method, 8)
    header.writeUInt32LE(data.length, 18)
    header.writeUInt16LE(name.length, 26)
    parts.push(header, name, data)
  }
  return new Uint8Array(Buffer.concat(parts))
}
