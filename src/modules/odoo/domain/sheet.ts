import { inflateRawSync } from 'node:zlib'

function readZip(bytes: Uint8Array): Map<string, Uint8Array> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const entries = new Map<string, Uint8Array>()
  let offset = 0
  while (offset + 30 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const method = view.getUint16(offset + 8, true)
    const compressedSize = view.getUint32(offset + 18, true)
    const nameLength = view.getUint16(offset + 26, true)
    const extraLength = view.getUint16(offset + 28, true)
    const nameStart = offset + 30
    const name = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLength))
    const dataStart = nameStart + nameLength + extraLength
    const compressed = bytes.subarray(dataStart, dataStart + compressedSize)
    if (method === 0) entries.set(name, compressed)
    else if (method === 8) entries.set(name, inflateRawSync(compressed))
    offset = dataStart + compressedSize
  }
  return entries
}

function texts(xml: string): string[] {
  return [...xml.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((match) => match[1] ?? '')
}

function cellValue(cell: string, shared: string[]): string {
  const type = /t="([^"]+)"/.exec(cell)?.[1] ?? ''
  const value = /<v>([^<]*)<\/v>/.exec(cell)?.[1] ?? ''
  if (type === 's') return shared[Number(value)] ?? ''
  if (type === 'inlineStr') return texts(cell).join('')
  return value
}

/** Reads the first worksheet of an xlsx file into rows. */
export function readXlsxRows(bytes: Uint8Array): string[][] {
  const zip = readZip(bytes)
  const sharedXml = [...zip.entries()].find(([name]) => name.endsWith('sharedStrings.xml'))?.[1]
  const sheetXml = [...zip.entries()].find(([name]) => /xl\/worksheets\/sheet1\.xml$/.test(name))?.[1]
  if (!sheetXml) return []
  const shared = sharedXml ? texts(new TextDecoder().decode(sharedXml)) : []
  const sheet = new TextDecoder().decode(sheetXml)
  return [...sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map((row) =>
    [...(row[1] ?? '').matchAll(/<c\b[^>]*>[\s\S]*?<\/c>/g)].map((cell) => cellValue(cell[0], shared)),
  )
}
