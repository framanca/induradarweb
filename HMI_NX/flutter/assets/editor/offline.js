(function () {
  'use strict';
  const boot = window.NX_OFFLINE;
  if (!boot || typeof boot.token !== 'string') throw new Error('Abre este editor desde la aplicación Flutter.');
  let revision = boot.revision;
  const values = Object.assign(Object.create(null), boot.values);
  const endpoint = name => new URL('_native/' + name, document.baseURI).href;
  const headers = { 'Content-Type': 'application/json', 'X-NX-Offline': boot.token };

  // The editor's destructive-action guard is synchronous. Loopback XHR keeps
  // that contract: success means Dart has flushed and committed the file.
  function storageWrite(key, value) {
    const request = new XMLHttpRequest();
    request.open('POST', endpoint('storage'), false);
    Object.entries(headers).forEach(([name, text]) => request.setRequestHeader(name, text));
    request.send(JSON.stringify({ key, value, revision }));
    const result = JSON.parse(request.responseText || '{}');
    if (request.status !== 200) throw new Error(result.error || 'No se pudo guardar en disco.');
    revision = result.revision;
    if (value === null) delete values[key]; else values[key] = value;
  }
  async function api(name, data) {
    const response = await fetch(endpoint(name), { method: data === undefined ? 'GET' : 'POST', headers, body: data === undefined ? undefined : JSON.stringify(data), cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Error de archivos locales');
    return result;
  }
  function showMessage(text) {
    const toast = document.querySelector('#toast');
    if (toast) { toast.textContent = text; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 5000); }
  }
  function encode(bytes) {
    let text = '';
    for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(text);
  }
  async function download(name, data, type) {
    const blob = new Blob([data], { type });
    const result = await api('export', { name, base64: encode(new Uint8Array(await blob.arrayBuffer())) });
    if (!result.saved) showMessage('Guardado externo cancelado. La copia local se conserva.');
    return result.saved;
  }
  const nativeClick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function () {
    if (this.type !== 'file') return nativeClick.call(this);
    const input = this;
    api('pick', { kind: input.id }).then(result => {
      if (!result.file) return;
      const file = result.file, binary = atob(file.base64);
      const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], file.name, { type: file.mime }));
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }).catch(error => showMessage(error.message));
  };
  window.NXOffline = {
    storage: { getItem: key => values[key] ?? null, setItem: (key, value) => storageWrite(key, String(value)), removeItem: key => storageWrite(key, null) },
    download,
  };

  function button(text, action, host) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.onclick = action; host.append(b); return b;
  }
  async function versions() {
    try {
      const rows = await api('versions');
      const dialog = document.createElement('dialog'); dialog.className = 'offline-versions';
      const title = document.createElement('h2'); title.textContent = 'Versiones guardadas en disco'; dialog.append(title);
      for (const row of rows) {
        const item = document.createElement('div'); item.className = 'recovery-item';
        const label = document.createElement('span'); label.textContent = row.name + ' · ' + new Date(row.savedAt).toLocaleString(); item.append(label);
        button('Recuperar', async () => {
          try {
            const project = await api('version?id=' + encodeURIComponent(row.id));
            if (window.NXOfflineEditor.openProject(project)) { dialog.close(); dialog.remove(); }
          } catch (error) { showMessage(error.message); }
        }, item);
        dialog.append(item);
      }
      if (!rows.length) { const p = document.createElement('p'); p.textContent = 'Todavía no hay versiones anteriores.'; dialog.append(p); }
      button('Cerrar', () => { dialog.close(); dialog.remove(); }, dialog);
      document.body.append(dialog); dialog.showModal();
    } catch (error) { showMessage(error.message); }
  }
  document.addEventListener('DOMContentLoaded', () => {
    button('Versiones en disco', versions, document.querySelector('.top-actions'));
    const nav = document.createElement('nav'); nav.className = 'offline-panels';
    for (const [key, label] of [['tools', 'Herramientas'], ['canvas', 'Lienzo'], ['properties', 'Propiedades']]) {
      const b = button(label, () => { document.body.dataset.panel = key; nav.querySelectorAll('[data-panel]').forEach(n => n.classList.toggle('active', n.dataset.panel === key)); }, nav);
      b.dataset.panel = key; b.classList.toggle('active', key === 'canvas');
    }
    document.querySelector('.layout').before(nav); document.body.dataset.panel = 'canvas';
    const commands = document.querySelector('.canvas-head');
    button('Copiar', () => window.NXOfflineEditor.copyWidget(), commands);
    button('Pegar', () => window.NXOfflineEditor.pasteWidget(), commands);
    document.querySelector('.topbar strong').textContent = 'WebHMI Offline';
    if (boot.notice) showMessage(boot.notice);
  });
})();
