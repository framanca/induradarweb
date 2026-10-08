'use strict';
// Verify *deployed* editor bundles, not only checked-in source files.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const siteRoot = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Usage: node scripts/verify_webhmi_bundle.cjs <site-build-dir>');

for (const editor of ['HMI_NX', 'HMI_NX_ST']) {
  const folder = path.join(siteRoot, editor);
  const page = path.join(folder, 'index.html');
  const html = fs.readFileSync(page, 'utf8');
  const imports = [];
  for (const match of html.matchAll(/<script\b[^>]*\bsrc=(["'])([^"']+)\1[^>]*><\/script>/gi)) {
    imports.push(match[2]);
  }
  if (!imports.includes('app.js')) throw new Error(editor + ': missing app.js reference');
  if (editor === 'HMI_NX_ST' && !imports.includes('history.js')) {
    throw new Error('HMI_NX_ST: missing undo/redo module reference');
  }
  if (imports.length !== new Set(imports).size) throw new Error(editor + ': repeated script reference');
  for (const source of imports) {
    if (!/^[a-z0-9_.-]+\.js$/i.test(source)) {
      throw new Error(editor + ': unexpected local script path ' + source);
    }
    const scriptPath = path.join(folder, source);
    if (!fs.existsSync(scriptPath)) {
      throw new Error(editor + ': ' + source + ' is referenced but missing from the published bundle');
    }
    new vm.Script(fs.readFileSync(scriptPath, 'utf8'), {filename: scriptPath});
  }
  for (const match of html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"/gi)) {
    const style = match[1];
    if (!/^[a-z0-9_.-]+\.css$/i.test(style) || !fs.existsSync(path.join(folder, style))) {
      throw new Error(editor + ': stylesheet missing from published bundle: ' + style);
    }
  }
  console.log(editor + ': published scripts OK (' + imports.join(', ') + ')');
}
