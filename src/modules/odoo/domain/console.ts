import { ODOO_COMPANY_ID, ODOO_ORIGIN, odooFields } from '@/modules/odoo/domain/odoo'

/** A same-origin snippet. It uses the open Odoo cookie and downloads a file. It does not send the cookie anywhere else. */
export function odooConsoleExtractor(): string {
  const fields = JSON.stringify(odooFields)
  return `(async function () {
  if (location.origin !== ${JSON.stringify(ODOO_ORIGIN)}) {
    console.error('Open https://venturefoods.walnutss.com first.');
    return;
  }
  const fields = ${fields};
  const dump = { source: ${JSON.stringify(ODOO_ORIGIN)}, companyId: ${ODOO_COMPANY_ID}, exportedAt: new Date().toISOString(), models: {} };
  const csrf = window.odoo && typeof window.odoo.csrf_token === 'string' ? window.odoo.csrf_token : '';
  for (const model of Object.keys(fields)) {
    const rows = [];
    for (let offset = 0; offset < 1000; offset += 200) {
      const response = await fetch('/web/dataset/call_kw/' + model + '/search_read', {
        method: 'POST',
        credentials: 'same-origin',
        headers: Object.assign({ 'Content-Type': 'application/json' }, csrf ? { 'X-CSRF-Token': csrf } : {}),
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {
            model: model,
            method: 'search_read',
            args: [[]],
            kwargs: { fields: fields[model], limit: 200, offset: offset, context: { allowed_company_ids: [${ODOO_COMPANY_ID}] } }
          }
        })
      });
      const payload = await response.json();
      const page = payload && Array.isArray(payload.result) ? payload.result : [];
      rows.push.apply(rows, page);
      if (page.length < 200) break;
    }
    dump.models[model] = rows;
  }
  const blob = new Blob([JSON.stringify(dump)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'venturefoods_odoo_dump.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
})();`
}
