function cell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: Array<Array<string | number>>) {
  return [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}
