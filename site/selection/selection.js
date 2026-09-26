import { getSupabaseClient, currentSession } from '../auth-client.js';
import { renderSelection, validReference } from './renderer.js';

const root = document.querySelector('#selection-root');
const status = document.querySelector('#selection-status');
const auth = document.querySelector('#selection-auth');
const tools = document.querySelector('#selection-tools');
const form = document.querySelector('#selection-login');
const jsonButton = document.querySelector('#selection-json');
const lightButton = document.querySelector('#selection-light');
const reference = (new URLSearchParams(location.search).get('ref') || '').trim().toUpperCase();
let generation = 0, lightPayload = null, userId = null, downloaded = false, printState = [];

function setStatus(message, kind = 'info') {
  status.textContent = message;
  status.dataset.kind = kind;
  status.hidden = !message;
}
function clearReport() { lightPayload = null; root.replaceChildren(); tools.hidden = true; }
function download(payload, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function getPayload(format) {
  const client = getSupabaseClient();
  if (!client) throw new Error('client_unavailable');
  const { data, error } = await client.rpc('get_curated_report_v1', { p_report_reference: reference, p_format: format });
  if (error) throw error;
  if (!data?.found || data.report_reference !== reference || !data.payload) throw new Error('selection_unavailable');
  return data.payload;
}
async function downloadFull() {
  jsonButton.disabled = true;
  const ticket = generation;
  try {
    const p = await getPayload('json');
    if (ticket !== generation) return;
    if (p.report_reference !== reference || p.report_schema_version !== 'curated-selection-1.0.0') throw new Error('invalid_selection');
    download(p, `InduRadar_Report_JSON_${reference}.json`);
  } catch {
    setStatus('No se ha podido obtener el JSON aprobado. Comprueba tu sesión e inténtalo de nuevo.', 'error');
  } finally { jsonButton.disabled = false; }
}
async function start() {
  const ticket = ++generation;
  clearReport(); auth.hidden = true;
  if (!validReference(reference)) { setStatus('La referencia del informe no es válida.', 'error'); return; }
  document.title = `${reference} · Selección | InduRadar`;
  setStatus('Cargando selección aprobada…');
  try {
    const session = await currentSession();
    if (ticket !== generation) return;
    userId = session?.user?.id || null;
    if (!userId) { auth.hidden = false; setStatus('Inicia sesión para consultar esta selección.'); return; }
    const payload = await getPayload('light');
    if (ticket !== generation) return;
    const result = renderSelection(root, payload, reference);
    if (result.renderedCount !== Number(payload.selection_method?.selected)) throw new Error('selection_count_mismatch');
    lightPayload = payload; tools.hidden = false; setStatus('');
    if (!downloaded && new URLSearchParams(location.search).get('download') === 'json') {
      downloaded = true; await downloadFull();
      const params = new URLSearchParams(location.search); params.delete('download');
      history.replaceState(null, '', `${location.pathname}?${params}`);
    }
  } catch (error) {
    if (ticket !== generation) return;
    clearReport();
    if (error?.code === '42501' || error?.status === 401) auth.hidden = false;
    setStatus('La selección no está disponible para esta sesión o no se ha podido verificar. Entra desde tu portal y vuelve a intentarlo.', 'error');
  }
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('button'); button.disabled = true;
  try {
    const client = getSupabaseClient(); if (!client) throw new Error('client_unavailable');
    const { error } = await client.auth.signInWithPassword({ email: form.elements.email.value.trim(), password: form.elements.password.value });
    form.elements.password.value = '';
    if (error) throw error;
    await start();
  } catch { setStatus('No se ha podido iniciar sesión. Comprueba el email, la contraseña y la confirmación de tu cuenta.', 'error'); }
  finally { button.disabled = false; }
});
jsonButton.addEventListener('click', downloadFull);
lightButton.addEventListener('click', () => { if (lightPayload) download(lightPayload, `InduRadar_Light_Report_${reference}.json`); });
document.querySelector('#selection-print').addEventListener('click', () => window.print());
window.addEventListener('beforeprint', () => { printState = [...root.querySelectorAll('details')].map(n => [n, n.open]); printState.forEach(([n]) => { n.open = true; }); });
window.addEventListener('afterprint', () => { printState.forEach(([n, open]) => { n.open = open; }); printState = []; });
const client = getSupabaseClient();
client?.auth.onAuthStateChange((event, session) => {
  const nextId = session?.user?.id || null;
  if (event === 'SIGNED_OUT') { ++generation; userId = null; clearReport(); auth.hidden = false; setStatus('La sesión se ha cerrado. Inicia sesión para ver el informe.'); }
  else if (nextId && nextId !== userId) setTimeout(() => void start(), 0);
});
void start();
