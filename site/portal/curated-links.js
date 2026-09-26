// Additive routing for the distinct curated-selection document type.
// Ordinary reports, XLSX exports and feedback keep their existing paths.
import { getSupabaseClient, currentSession } from '../auth-client.js';
const root = document.querySelector('#report-list');
const client = getSupabaseClient();
let curated = new Set(), loadedFor = null, pending = null, generation = 0;
const valid = ref => /^IR-[0-9]{8}-[0-9A-HJKMNP-TV-Z]{6}$/.test(ref);
function applyLinks() {
  if (!root) return;
  for (const row of root.querySelectorAll('article.row')) {
    if (row.dataset.curatedSelection === 'true') continue;
    const first = row.querySelector('a.report-link');
    if (!first) continue;
    let ref;
    try { ref = new URL(first.href, location.origin).searchParams.get('ref') || ''; } catch { continue; }
    if (!valid(ref) || !curated.has(ref)) continue;
    const actions = row.querySelector('.report-actions');
    if (!actions) continue;
    const open = document.createElement('a'); open.className = 'report-link'; open.href = `/selection/?ref=${encodeURIComponent(ref)}`; open.textContent = 'Abrir selección';
    const json = document.createElement('a'); json.className = 'report-link report-link-secondary'; json.href = `/selection/?ref=${encodeURIComponent(ref)}&download=json`; json.textContent = 'Descargar JSON';
    actions.replaceChildren(open, json);
    row.dataset.curatedSelection = 'true';
  }
}
async function refresh() {
  if (!client || pending) return pending;
  const ticket = generation;
  pending = (async () => {
    const session = await currentSession();
    if (ticket !== generation) return;
    const id = session?.user?.id;
    if (!id) { curated = new Set(); loadedFor = null; return; }
    if (loadedFor === id) { applyLinks(); return; }
    const { data, error } = await client.rpc('portal_list_available_reports');
    if (ticket !== generation) return;
    if (error) { console.warn('Curated report routing unavailable'); return; }
    curated = new Set((data || []).filter(r => r.status === 'curated_ready' && valid(r.report_reference || '')).map(r => r.report_reference));
    loadedFor = id; applyLinks();
  })().finally(() => { pending = null; });
  return pending;
}
if (root) new MutationObserver(applyLinks).observe(root, { childList: true, subtree: true });
client?.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT') { generation++; curated = new Set(); loadedFor = null; }
  else if (session?.user?.id && session.user.id !== loadedFor) setTimeout(() => void refresh(), 0);
});
void refresh();
