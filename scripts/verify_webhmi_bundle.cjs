'use strict';
// Verify *deployed* editor bundles, and that ST/Online code is cache-busted.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const siteRoot = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Usage: node scripts/verify_webhmi_bundle.cjs <site-build-dir>');

for (const editor of ['HMI_NX', 'HMI_NX_ST', 'HMI_NX_Online']) {
  const folder = path.join(siteRoot, editor);
  const html = fs.readFileSync(path.join(folder, 'index.html'), 'utf8');
  const scriptRefs = [...html.matchAll(/<script\b[^>]*\bsrc=(["'])([^"']+)\1[^>]*><\/script>/gi)].map(m => m[2]);
  const imports = scriptRefs.map(ref => ref.split('?')[0]);
  if (!imports.includes('app.js')) throw new Error(editor + ': missing app.js reference');
  if (editor === 'HMI_NX_ST' && !imports.includes('history.js')) {
    throw new Error('HMI_NX_ST: missing undo/redo module reference');
  }
  if (imports.length !== new Set(imports).size) throw new Error(editor + ': repeated script reference');

  const checkFile = (ref, extension) => {
    const [source, query, extra] = ref.split('?');
    if (extra !== undefined || !new RegExp('^[a-z0-9_.-]+\\.' + extension + '$', 'i').test(source)) {
      throw new Error(editor + ': unexpected asset path ' + ref);
    }
    const asset = path.join(folder, source);
    if (!fs.existsSync(asset)) throw new Error(editor + ': asset missing from published bundle: ' + source);
    if (editor !== 'HMI_NX') {
      const expected = crypto.createHash('sha256').update(fs.readFileSync(asset)).digest('hex').slice(0, 12);
      if (query !== 'v=' + expected) throw new Error(editor + ': cached/stale or missing asset fingerprint: ' + ref);
    } else if (query !== undefined) throw new Error(editor + ': unexpected query in asset URL: ' + ref);
    return asset;
  };
  for (const ref of scriptRefs) {
    const scriptPath = checkFile(ref, 'js');
    new vm.Script(fs.readFileSync(scriptPath, 'utf8'), {filename: scriptPath});
  }
  for (const match of html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"/gi)) {
    checkFile(match[1], 'css');
  }
  console.log(editor + ': published scripts OK (' + scriptRefs.join(', ') + ')');
}
