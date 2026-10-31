import { ODOO_COMPANY_ID, ODOO_ORIGIN, odooFields, type OdooModel } from '@/modules/odoo/domain/odoo'

/** A same-origin snippet. It uses the open Odoo cookie and downloads a file. It does not send the cookie anywhere else. */
export function odooConsoleExtractor(): string {
  const fields = JSON.stringify(Object.fromEntries((Object.keys(odooFields) as OdooModel[]).map((model) => [model, [...odooFields[model]]])))
  return `(async function () {
  if (location.origin !== ${JSON.stringify(ODOO_ORIGIN)}) {
    console.error('Open https://venturefoods.walnutss.com first.');
    return;
  }
  const fields = ${fields};
  const company = { allowed_company_ids: [${ODOO_COMPANY_ID}], cids: ${ODOO_COMPANY_ID} };
  const infoResponse = await fetch('/web/session/get_session_info', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: 1, params: {} })
  });
  const info = await infoResponse.json();
  const session = info && info.result ? info.result : null;
  if (!session || !session.uid) {
    console.error('Sign in on the Venture Foods menu, then paste the snippet again.');
    return;
  }
  const token = session.csrf_token || (window.odoo && window.odoo.csrf_token) || '';
  async function callKw(model, method, args, kwargs) {
    const response = await fetch('/web/dataset/call_kw/' + model + '/' + method, {
      method: 'POST',
      credentials: 'same-origin',
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { 'X-CSRF-Token': token } : {}),
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: 1, params: { model: model, method: method, args: args, kwargs: kwargs } })
    });
    const text = await response.text();
    let payload = null;
    try { payload = JSON.parse(text); } catch (error) {
      console.warn(model + '.' + method, response.status, text.slice(0, 180));
      return null;
    }
    if (!payload || payload.error) {
      const detail = payload && payload.error && payload.error.data ? payload.error.data.message : '';
      console.warn(model + '.' + method, detail || (payload && payload.error && payload.error.message) || 'refused');
      return null;
    }
    return payload.result;
  }
  const dump = { source: ${JSON.stringify(ODOO_ORIGIN)}, companyId: ${ODOO_COMPANY_ID}, exportedAt: new Date().toISOString(), models: {} };
  for (const model of Object.keys(fields)) {
    let use = fields[model];
    const available = await callKw(model, 'fields_get', [], { attributes: ['string'], context: company });
    if (available && typeof available === 'object') {
      const names = Object.keys(available);
      use = fields[model].filter(function (name) { return names.indexOf(name) !== -1; });
      if (use.indexOf('id') === -1 && names.indexOf('id') !== -1) use.unshift('id');
      if (!use.length) use = names.indexOf('display_name') !== -1 ? ['id', 'display_name'] : ['id'];
    }
    const rows = [];
    for (let offset = 0; offset < 1000; offset += 200) {
      const page = await callKw(model, 'search_read', [[]], { fields: use, limit: 200, offset: offset, context: company });
      const list = Array.isArray(page) ? page : [];
      rows.push.apply(rows, list);
      if (!Array.isArray(page) || list.length < 200) break;
    }
    dump.models[model] = rows;
  }
  const counts = {};
  Object.keys(dump.models).forEach(function (model) { counts[model] = dump.models[model].length; });
  console.table(counts);
  const blob = new Blob([JSON.stringify(dump)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'venturefoods_odoo_cids1_dump.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
})();`
}
