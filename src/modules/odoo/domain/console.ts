import {
  closedBranchFamilyFragments,
  exclusionDomainFragments,
} from '@/lib/odoo/excluded-entities'
import { ODOO_COMPANY_ID, ODOO_ORIGIN, odooFields, type OdooModel } from '@/modules/odoo/domain/odoo'

/** A same-origin snippet. It uses the open Odoo cookie and downloads a file. It does not send the cookie anywhere else. */
export function odooConsoleExtractor(): string {
  const fields = JSON.stringify(Object.fromEntries((Object.keys(odooFields) as OdooModel[]).map((model) => [model, [...odooFields[model]]])))
  const excluded = JSON.stringify(exclusionDomainFragments())
  const closedBranchFamily = JSON.stringify(closedBranchFamilyFragments())
  return `(async function () {
  if (location.origin !== ${JSON.stringify(ODOO_ORIGIN)}) {
    console.error('Open https://venturefoods.walnutss.com first.');
    return;
  }
  const fields = ${fields};
  const excluded = ${excluded};
  const closedBranchFamily = ${closedBranchFamily};
  function rowKept(row) {
    var cliticRe = /^(?:\\u0644\\u0644|\\u0628|\\u0648|\\u0644)/;
    function stripAr(t) {
      return t.replace(cliticRe, '');
    }
    function norm(s) {
      return String(s || '')
        .normalize('NFKD')
        .replace(/[\\u064b-\\u0652\\u0670\\u0640]/g, '')
        .replace(/[\\u0623\\u0625\\u0622]/g, '\\u0627')
        .replace(/\\u0649/g, '\\u064a')
        .replace(/\\u0629/g, '\\u0647')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
        .replace(/([a-z\\u0600-\\u06ff])(\\d)/gi, '$1 $2')
        .replace(/(\\d)([a-z\\u0600-\\u06ff])/gi, '$1 $2')
        .toLowerCase();
    }
    function rowTexts(val, out) {
      if (typeof val === 'string') { out.push(val); return; }
      if (!val || typeof val !== 'object') return;
      if (Array.isArray(val)) {
        for (var i = 0; i < val.length; i += 1) rowTexts(val[i], out);
        return;
      }
      var keys = Object.keys(val);
      for (var k = 0; k < keys.length; k += 1) {
        if (keys[k] === 'image_128') continue;
        rowTexts(val[keys[k]], out);
      }
    }
    function hasCanteenExemption(expanded, parts) {
      if (/\\bschool\\s+canteens?\\b/.test(expanded)) return true;
      var hasSingularSchool = false;
      var hasStreet = false;
      for (var i = 0; i < parts.length; i += 1) {
        var tok = parts[i];
        var ar = stripAr(tok);
        if (tok === 'npis' || tok === 'faips' || tok === 'fas' || tok === 'canteen' || tok === 'canteens') return true;
        if (tok === '\\u0645\\u0642\\u0635\\u0641' || tok === '\\u0627\\u0644\\u0645\\u0642\\u0635\\u0641' || ar === '\\u0645\\u0642\\u0635\\u0641' || ar === '\\u0627\\u0644\\u0645\\u0642\\u0635\\u0641') return true;
        if (tok === '\\u0645\\u062f\\u0631\\u0633\\u0647' || tok === '\\u0627\\u0644\\u0645\\u062f\\u0631\\u0633\\u0647' || ar === '\\u0645\\u062f\\u0631\\u0633\\u0647' || ar === '\\u0627\\u0644\\u0645\\u062f\\u0631\\u0633\\u0647') hasSingularSchool = true;
        if (tok === 'street' || tok === 'streets' || tok === '\\u0634\\u0627\\u0631\\u0639' || tok === '\\u0627\\u0644\\u0634\\u0627\\u0631\\u0639' || ar === '\\u0634\\u0627\\u0631\\u0639' || ar === '\\u0627\\u0644\\u0634\\u0627\\u0631\\u0639') hasStreet = true;
      }
      return hasSingularSchool && !hasStreet;
    }
    function tokenCandidates(tok) {
      var list = [tok];
      var ar = stripAr(tok);
      if (ar && ar !== tok) list.push(ar);
      var al = tok.replace(/^al(?=[a-z]{4,})/, '');
      if (al && al !== tok) list.push(al);
      var baseLen = list.length;
      for (var i = 0; i < baseLen; i += 1) {
        var suf = list[i].replace(/(?:kw|kwt|kuwait|wh|pos)$/, '');
        if (suf !== list[i] && suf.length >= 3) list.push(suf);
      }
      return list;
    }
    var texts = [];
    rowTexts(row, texts);
    var rawBlob = texts.join(' ');
    var expanded = norm(rawBlob);
    var parts = expanded.split(/[^0-9a-z\\u0600-\\u06ff]+/).filter(Boolean);
    var canteenExempt = hasCanteenExemption(expanded, parts);
    var rawWords = rawBlob.normalize('NFKD').split(/[^0-9a-zA-Z\\u0600-\\u06ff]+/).filter(Boolean);
    return excluded.every(function (fragment) {
      var low = norm(fragment).trim();
      var isClosed = closedBranchFamily.indexOf(fragment) !== -1;
      return rawWords.every(function (rawWord) {
        var hasDigit = /\\d/.test(rawWord);
        var subParts = norm(rawWord).split(/[^0-9a-z\\u0600-\\u06ff]+/).filter(Boolean);
        return subParts.every(function (tok) {
          var cands = tokenCandidates(tok);
          for (var c = 0; c < cands.length; c += 1) {
            if (cands[c] === low) {
              if (isClosed && canteenExempt && !hasDigit) continue;
              return false;
            }
          }
          return true;
        });
      });
    });
  }
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
      rows.push.apply(rows, list.filter(rowKept));
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
