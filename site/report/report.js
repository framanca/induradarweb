import { buildReportViewModel, renderReport } from './renderer.js';
import { currentSession, getSupabaseClient } from '../auth-client.js';

const statusNode = document.querySelector('#report-status');
const reportNode = document.querySelector('#report-root');
const referenceNode = document.querySelector('#report-reference');
const dateNode = document.querySelector('#report-date');
const printButton = document.querySelector('#print-report');
const excelButton = document.querySelector('#download-xlsx');
const reportAuthNode = document.querySelector('#report-auth');
const reportAuthStatusNode = document.querySelector('#report-auth-status');
const reportAuthForm = document.querySelector('#report-auth-form');
const feedbackButton = document.querySelector('#open-feedback');
const updateButton = document.querySelector('#request-update');
const interactionDrawer = document.querySelector('#interaction-drawer');
const interactionBackdrop = document.querySelector('#interaction-backdrop');
const interactionList = document.querySelector('#interaction-list');
const interactionStatusNode = document.querySelector('#interaction-status');
const interactionCompanySearchWrap = document.querySelector('#interaction-company-search-wrap');
const interactionCompanySearch = document.querySelector('#interaction-company-search');
const updateDialog = document.querySelector('#report-update-dialog');
const updateForm = document.querySelector('#report-update-form');
const updateStatusNode = document.querySelector('#report-update-status');
let printState = [];
let canonicalFrame = null;
let canonicalObserver = null;
let interactionData = null;
let interactionTab = 'opportunities';

function setStatus(message, kind = 'info') {
  statusNode.textContent = message;
  statusNode.dataset.kind = kind;
  statusNode.hidden = !message;
}

function setAuthStatus(message = '', kind = 'error') {
  reportAuthStatusNode.textContent = message;
  reportAuthStatusNode.dataset.kind = kind;
  reportAuthStatusNode.hidden = !message;
}

function authErrorMessage(error) {
  const message = error?.message ?? '';
  if (message.includes('Invalid login credentials')) return 'El email o la contraseña no son correctos.';
  if (message.includes('Email not confirmed')) return 'Confirma tu email antes de entrar.';
  return 'No se ha podido completar el acceso. Inténtalo de nuevo.';
}

function showReportLogin() {
  reportAuthNode.hidden = false;
  reportAuthForm.elements.email.focus();
}

function reportReference() {
  const value = new URLSearchParams(window.location.search).get('ref')?.trim().toUpperCase() ?? '';
  return /^IR-[0-9]{8}-[0-9A-HJKMNP-TV-Z]{6}$/.test(value) ? value : '';
}

async function getAccessToken() {
  const provider = window.INDURADAR_AUTH;
  if (provider && typeof provider.getAccessToken === 'function') {
    const value = await provider.getAccessToken();
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  const session = await currentSession();
  return session?.access_token || sessionStorage.getItem('induradar_access_token') || '';
}

function endpoint() {
  const value = window.INDURADAR_CONFIG?.reportEndpoint;
  return typeof value === 'string' ? value.trim() : '';
}

async function reportRequest(reference, format, accept) {
  const reportEndpoint = endpoint();
  if (!reportEndpoint) throw new Error('report_endpoint_not_configured');

  const token = await getAccessToken();
  if (!token) throw new Error('authentication_required');

  const url = new URL(reportEndpoint);
  url.searchParams.set('ref', reference);
  url.searchParams.set('format', format);
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: accept,
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
    credentials: 'omit',
  });

  if (response.status === 401 || response.status === 403) throw new Error('authentication_required');
  if (response.status === 404) throw new Error('report_not_available');
  if (response.status === 409 && format === 'html') throw new Error('legacy_report');
  if (!response.ok) throw new Error('report_load_failed');
  return response;
}

async function fetchCanonicalHtml(reference) {
  const response = await reportRequest(reference, 'html', 'text/html');
  const html = await response.text();
  if (!/^\s*<!doctype html>/i.test(html)) throw new Error('invalid_canonical_html');
  return html;
}

function attachmentName(response, fallback) {
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/i);
  return match?.[1] || fallback;
}

async function downloadXlsx(reference) {
  const response = await reportRequest(
    reference,
    'xlsx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  const blob = await response.blob();
  const name = attachmentName(response, `InduRadar_Datos_${reference}.xlsx`);
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.style.display = 'none';
    document.body.append(link);
    link.click();
    link.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

async function fetchLegacyReport(reference) {
  const response = await reportRequest(reference, 'json', 'application/json');
  const body = await response.json();
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_report_payload');
  return body;
}

function messageFor(error) {
  switch (error?.message) {
    case 'authentication_required':
      return 'Este informe requiere una sesión autenticada de InduRadar.';
    case 'report_not_available':
      return 'El informe no está disponible o tu cuenta no tiene acceso.';
    case 'report_endpoint_not_configured':
      return 'El visor de informes todavía no está conectado al portal.';
    case 'invalid_report_payload':
    case 'invalid_canonical_html':
      return 'La respuesta del informe no cumple el formato esperado.';
    default:
      return 'No se ha podido cargar el informe. Inténtalo de nuevo desde el portal.';
  }
}


function makeNode(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== '') node.textContent = String(text);
  return node;
}

function setInteractionStatus(message = '', kind = 'success') {
  interactionStatusNode.textContent = message;
  interactionStatusNode.dataset.kind = kind;
  interactionStatusNode.hidden = !message;
}

function setUpdateStatus(message = '', kind = 'success') {
  updateStatusNode.textContent = message;
  updateStatusNode.dataset.kind = kind;
  updateStatusNode.hidden = !message;
}

async function rpc(name, args) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('authentication_required');
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data;
}

async function loadInteractions(reference) {
  return rpc('portal_get_report_interactions_v1', { p_report_reference: reference });
}

function openFeedbackDrawer(tab = 'opportunities', companyId = '') {
  interactionTab = tab;
  interactionDrawer.hidden = false;
  interactionBackdrop.hidden = false;
  document.body.style.overflow = 'hidden';
  setInteractionStatus();
  renderInteractionList();
  if (companyId) {
    requestAnimationFrame(() => {
      const target = interactionList.querySelector('[data-company-id="' + CSS.escape(companyId) + '"]');
      if (target) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }
}

function closeFeedbackDrawer() {
  interactionDrawer.hidden = true;
  interactionBackdrop.hidden = true;
  document.body.style.overflow = '';
}

function selectedThumb(button, selected, negative = false) {
  button.className = 'thumb-button' + (negative ? ' is-negative' : '') + (selected ? ' is-selected' : '');
  button.setAttribute('aria-pressed', selected ? 'true' : 'false');
}

async function saveOpportunityFeedback(item, useful, reason = '') {
  const reference = reportReference();
  if (!reference || !item?.company_id) return;
  setInteractionStatus('Guardando tu valoración…');
  try {
    await rpc('portal_submit_feedback_v1', {
      p_report_reference: reference,
      p_entity_type: 'client_opportunity',
      p_entity_id: item.company_id,
      p_useful: useful,
      p_reason: reason || null,
    });
    item.useful = useful;
    item.reason = reason || null;
    setInteractionStatus(useful ? 'Gracias. Hemos guardado que esta oportunidad te ha resultado valiosa.' : 'Gracias. Usaremos este comentario para afinar tus próximos informes.');
    renderInteractionList();
    injectInlineInteractions();
  } catch (error) {
    console.error('Opportunity feedback failed', error);
    setInteractionStatus('No se ha podido guardar la valoración. Inténtalo de nuevo.', 'error');
  }
}

function openOpportunityReason(card, item) {
  card.querySelector('.feedback-note')?.remove();
  const wrap = makeNode('div', 'feedback-note');
  const hint = makeNode('small', '', 'Ayúdanos a entender qué es interesante para tus informes. El comentario es opcional.');
  const textarea = document.createElement('textarea');
  textarea.maxLength = 2000;
  textarea.placeholder = '¿Qué no ha encajado o qué tipo de oportunidad sería más útil?';
  textarea.value = item.reason || '';
  const actions = makeNode('div', 'feedback-note-actions');
  const skip = makeNode('button', 'secondary-action', 'Guardar sin comentario');
  skip.type = 'button';
  const send = makeNode('button', 'primary-action', 'Enviar comentario');
  send.type = 'button';
  skip.addEventListener('click', () => void saveOpportunityFeedback(item, false, ''));
  send.addEventListener('click', () => void saveOpportunityFeedback(item, false, textarea.value.trim()));
  actions.append(skip, send);
  wrap.append(hint, textarea, actions);
  card.append(wrap);
  textarea.focus();
}

function renderOpportunityFeedback() {
  const rows = Array.isArray(interactionData?.opportunities) ? interactionData.opportunities : [];
  if (!rows.length) {
    interactionList.append(makeNode('p', 'section-copy', 'Este informe no tiene oportunidades valorables con identidad de empresa resuelta.'));
    return;
  }
  for (const item of rows) {
    const card = makeNode('article', 'feedback-card');
    card.dataset.companyId = item.company_id;
    const head = makeNode('div', 'feedback-card-head');
    const copy = makeNode('div');
    copy.append(
      makeNode('strong', '', (item.rank ? '#' + item.rank + ' · ' : '') + (item.company || 'Empresa')),
      makeNode('small', '', [item.temperature, item.opportunity_rank_score ? 'Rank ' + item.opportunity_rank_score : ''].filter(Boolean).join(' · ')),
    );
    head.append(copy);
    const actions = makeNode('div', 'feedback-actions');
    const up = makeNode('button', '', '👍');
    up.type = 'button';
    up.title = 'Esta oportunidad me resulta valiosa';
    selectedThumb(up, item.useful === true);
    up.addEventListener('click', () => void saveOpportunityFeedback(item, true, ''));
    const down = makeNode('button', '', '👎');
    down.type = 'button';
    down.title = 'Esta oportunidad no encaja';
    selectedThumb(down, item.useful === false, true);
    down.addEventListener('click', () => openOpportunityReason(card, item));
    actions.append(up, down);
    card.append(head, actions);
    if (item.useful === false && item.reason) card.append(makeNode('p', 'section-copy', 'Tu comentario: ' + item.reason));
    interactionList.append(card);
  }
}

async function saveCompanyPreference(item, preference, reason = '') {
  const reference = reportReference();
  if (!reference || !item?.company_id) return;
  const actionLabel = preference === 'preferred' ? 'Registrando la solicitud de profundización…' : preference === 'excluded' ? 'Guardando la exclusión…' : 'Restaurando la empresa…';
  setInteractionStatus(actionLabel);
  try {
    const result = await rpc('portal_set_company_preference_v1', {
      p_report_reference: reference,
      p_company_id: item.company_id,
      p_preference: preference,
      p_reason: reason || null,
    });
    item.preference = preference === 'neutral' ? null : preference;
    item.reason = reason || null;
    if (preference === 'preferred') {
      setInteractionStatus('Solicitud de profundización registrada' + (result?.submission_id ? ' · Submission ID ' + result.submission_id : '') + '. No se ha realizado un cargo automático de créditos.');
    } else if (preference === 'excluded') {
      setInteractionStatus('Empresa excluida de las nuevas solicitudes e informes de tu cuenta. Puedes deshacerlo en cualquier momento.');
    } else {
      setInteractionStatus('Preferencia retirada. La empresa vuelve a ser elegible en futuras solicitudes.');
    }
    renderInteractionList();
    injectInlineInteractions();
  } catch (error) {
    console.error('Company preference failed', error);
    setInteractionStatus('No se ha podido guardar la preferencia. Inténtalo de nuevo.', 'error');
  }
}

function openCompanyPreferenceReason(card, item, preference) {
  card.querySelector('.feedback-note')?.remove();
  const wrap = makeNode('div', 'feedback-note');
  const hintText = preference === 'preferred'
    ? 'Cuéntanos qué te interesa de esta empresa o qué quieres que investiguemos. Es opcional.'
    : 'Ayúdanos a entender por qué esta empresa no encaja. Es opcional.';
  wrap.append(makeNode('small', '', hintText));
  const textarea = document.createElement('textarea');
  textarea.maxLength = 2000;
  textarea.placeholder = preference === 'preferred'
    ? 'Ej. revisar nuevas inversiones, líneas, proyectos o señales recientes'
    : 'Ej. no es cliente objetivo, actividad incorrecta o fuera de nuestro mercado';
  textarea.value = item.reason || '';
  const actions = makeNode('div', 'feedback-note-actions');
  const cancel = makeNode('button', 'secondary-action', 'Cancelar');
  cancel.type = 'button';
  cancel.addEventListener('click', () => wrap.remove());
  const confirm = makeNode('button', 'primary-action', preference === 'preferred' ? 'Solicitar profundización' : 'Excluir empresa');
  confirm.type = 'button';
  confirm.addEventListener('click', () => void saveCompanyPreference(item, preference, textarea.value.trim()));
  actions.append(cancel, confirm);
  wrap.append(textarea, actions);
  card.append(wrap);
  textarea.focus();
}

function renderCompanyFeedback() {
  const all = Array.isArray(interactionData?.companies) ? interactionData.companies : [];
  const query = (interactionCompanySearch?.value || '').trim().toLocaleLowerCase('es');
  const rows = query ? all.filter((item) => String(item.company || '').toLocaleLowerCase('es').includes(query)) : all;
  if (!rows.length) {
    interactionList.append(makeNode('p', 'section-copy', query ? 'No hay empresas que coincidan con la búsqueda.' : 'No hay empresas disponibles para valorar.'));
    return;
  }
  for (const item of rows) {
    const stateClass = item.preference === 'excluded' ? ' is-excluded' : item.preference === 'preferred' ? ' is-preferred' : '';
    const card = makeNode('article', 'feedback-card' + stateClass);
    card.dataset.companyId = item.company_id;
    const head = makeNode('div', 'feedback-card-head');
    const copy = makeNode('div');
    const location = [item.municipality, item.province, item.country].filter(Boolean).join(' · ');
    copy.append(makeNode('strong', '', item.company || 'Empresa'), makeNode('small', '', location || ''));
    head.append(copy);
    card.append(head);

    if (item.preference === 'excluded') {
      card.append(makeNode('span', 'preference-badge', 'Excluida de futuros informes'));
    } else if (item.preference === 'preferred') {
      card.append(makeNode('span', 'preference-badge', 'Interesante · profundización solicitada'));
    }

    const actions = makeNode('div', 'feedback-actions');
    const up = makeNode('button', 'preference-button', '👍 Me interesa');
    up.type = 'button';
    up.dataset.preference = 'preferred';
    up.addEventListener('click', () => openCompanyPreferenceReason(card, item, 'preferred'));
    const down = makeNode('button', 'preference-button', '👎 No encaja');
    down.type = 'button';
    down.dataset.preference = 'excluded';
    down.addEventListener('click', () => openCompanyPreferenceReason(card, item, 'excluded'));
    actions.append(up, down);
    if (item.preference) {
      const undo = makeNode('button', 'secondary-action', 'Deshacer preferencia');
      undo.type = 'button';
      undo.addEventListener('click', () => void saveCompanyPreference(item, 'neutral', ''));
      actions.append(undo);
    }
    card.append(actions);
    if (item.reason) card.append(makeNode('p', 'section-copy', 'Nota: ' + item.reason));
    interactionList.append(card);
  }
}

function renderInteractionList() {
  if (!interactionList) return;
  interactionList.replaceChildren();
  document.querySelectorAll('.interaction-tab').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.interactionTab === interactionTab);
  });
  interactionCompanySearchWrap.hidden = interactionTab !== 'companies';
  if (!interactionData) {
    interactionList.append(makeNode('p', 'section-copy', 'Cargando opciones…'));
    return;
  }
  if (interactionTab === 'companies') renderCompanyFeedback();
  else renderOpportunityFeedback();
}

function inlineStyleDocument(doc) {
  if (!doc || doc.getElementById('induradar-portal-feedback-style')) return;
  const style = doc.createElement('style');
  style.id = 'induradar-portal-feedback-style';
  style.textContent = '.induradar-portal-feedback-inline{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:10px;padding-top:8px;border-top:1px solid #edf0f3}.induradar-portal-feedback-inline span{font-size:12px;color:#667085;font-weight:700}.induradar-portal-feedback-inline button{border:1px solid #d0d5dd;background:#fff;border-radius:999px;padding:4px 8px;cursor:pointer}.induradar-portal-feedback-inline button.sel{border-color:#0f766e;background:#ecfdf3}.induradar-portal-feedback-inline button.neg.sel{border-color:#b42318;background:#fee4e2}';
  doc.head.append(style);
}

function normalizeText(value) {
  return String(value || '').toLocaleLowerCase('es').replace(/\s+/g, ' ').trim();
}

function matchInteractionByText(rows, text) {
  const haystack = normalizeText(text);
  return [...rows].sort((a, b) => String(b.company || '').length - String(a.company || '').length)
    .find((item) => {
      const name = normalizeText(item.company);
      return name.length >= 3 && haystack.includes(name);
    });
}

function injectInlineInteractions(frame = canonicalFrame) {
  if (!frame || !interactionData) return;
  const doc = frame.contentDocument;
  if (!doc) return;
  inlineStyleDocument(doc);

  const opportunities = Array.isArray(interactionData.opportunities) ? interactionData.opportunities : [];
  doc.querySelectorAll('#oppGrid .card').forEach((card) => {
    card.querySelector('.induradar-portal-feedback-inline')?.remove();
    const item = matchInteractionByText(opportunities, card.textContent);
    if (!item) return;
    const wrap = doc.createElement('div');
    wrap.className = 'induradar-portal-feedback-inline';
    const label = doc.createElement('span');
    label.textContent = '¿Te ha resultado útil?';
    const up = doc.createElement('button');
    up.type = 'button';
    up.textContent = '👍';
    up.title = 'Oportunidad valiosa';
    if (item.useful === true) up.classList.add('sel');
    up.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void saveOpportunityFeedback(item, true, '');
    });
    const down = doc.createElement('button');
    down.type = 'button';
    down.textContent = '👎';
    down.title = 'No encaja';
    down.className = 'neg';
    if (item.useful === false) down.classList.add('sel');
    down.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openFeedbackDrawer('opportunities', item.company_id);
    });
    wrap.append(label, up, down);
    card.append(wrap);
  });

  const companies = Array.isArray(interactionData.companies) ? interactionData.companies : [];
  doc.querySelectorAll('#companyRows tr').forEach((row) => {
    row.querySelector('.induradar-portal-feedback-inline')?.remove();
    const item = matchInteractionByText(companies, row.textContent);
    if (!item) return;
    const cell = row.cells?.[1] || row.cells?.[0];
    if (!cell) return;
    const wrap = doc.createElement('div');
    wrap.className = 'induradar-portal-feedback-inline';
    const up = doc.createElement('button');
    up.type = 'button';
    up.textContent = '👍';
    up.title = 'Empresa interesante · solicitar profundización';
    if (item.preference === 'preferred') up.classList.add('sel');
    up.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openFeedbackDrawer('companies', item.company_id);
    });
    const down = doc.createElement('button');
    down.type = 'button';
    down.textContent = '👎';
    down.title = 'No quiero esta empresa en futuros informes';
    down.className = 'neg';
    if (item.preference === 'excluded') down.classList.add('sel');
    down.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openFeedbackDrawer('companies', item.company_id);
    });
    wrap.append(up, down);
    cell.append(wrap);
  });
}

function observeCanonicalRender(frame) {
  canonicalObserver?.disconnect();
  const doc = frame.contentDocument;
  if (!doc) return;
  const callback = () => window.setTimeout(() => injectInlineInteractions(frame), 20);
  canonicalObserver = new MutationObserver(callback);
  const oppGrid = doc.querySelector('#oppGrid');
  const companyRows = doc.querySelector('#companyRows');
  if (oppGrid) canonicalObserver.observe(oppGrid, { childList: true });
  if (companyRows) canonicalObserver.observe(companyRows, { childList: true });
}

function showCanonicalHtml(html, reference) {
  canonicalObserver?.disconnect();
  canonicalFrame = document.createElement('iframe');
  canonicalFrame.className = 'canonical-report-frame';
  canonicalFrame.title = 'Informe ' + reference;
  canonicalFrame.srcdoc = html;
  canonicalFrame.addEventListener('load', () => {
    injectInlineInteractions(canonicalFrame);
    observeCanonicalRender(canonicalFrame);
  });
  reportNode.replaceChildren(canonicalFrame);
}

function updateStorageKey(reference) {
  return 'induradar-report-update:' + reference;
}

function getUpdateRequestId(reference) {
  const key = updateStorageKey(reference);
  let value = sessionStorage.getItem(key) || '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    value = crypto.randomUUID();
    sessionStorage.setItem(key, value);
  }
  return value;
}

function openUpdateDialog() {
  setUpdateStatus();
  updateForm.reset();
  if (typeof updateDialog.showModal === 'function') updateDialog.showModal();
  else updateDialog.setAttribute('open', '');
  updateForm.elements.note.focus();
}

function closeUpdateDialog() {
  if (typeof updateDialog.close === 'function') updateDialog.close();
  else updateDialog.removeAttribute('open');
}

async function submitReportUpdate(event) {
  event.preventDefault();
  const reference = reportReference();
  const note = updateForm.elements.note.value.trim();
  if (!reference || note.length < 3) return;
  const submit = updateForm.querySelector('[type="submit"]');
  submit.disabled = true;
  setUpdateStatus('Registrando la solicitud…');
  try {
    const result = await rpc('portal_request_report_update_v1', {
      p_report_reference: reference,
      p_note: note,
      p_client_request_id: getUpdateRequestId(reference),
    });
    sessionStorage.removeItem(updateStorageKey(reference));
    setUpdateStatus('Solicitud registrada' + (result?.submission_id ? ' · Submission ID ' + result.submission_id : '') + '. Hemos enviado la petición a InduRadar.');
    window.setTimeout(closeUpdateDialog, 1200);
  } catch (error) {
    console.error('Report update request failed', error);
    setUpdateStatus('No se ha podido registrar la actualización. Inténtalo de nuevo.', 'error');
  } finally {
    submit.disabled = false;
  }
}


async function start() {
  const reference = reportReference();
  if (!reference) {
    setStatus('La referencia del informe no es válida.', 'error');
    return;
  }

  referenceNode.textContent = reference;
  document.title = `${reference} | InduRadar`;
  setStatus('Cargando informe…');
  reportAuthNode.hidden = true;
  setAuthStatus();
  feedbackButton.hidden = true;
  updateButton.hidden = true;
  printButton.hidden = true;
  if (excelButton) excelButton.hidden = true;
  interactionData = null;
  canonicalObserver?.disconnect();
  canonicalFrame = null;

  const params = new URLSearchParams(window.location.search);
  if (params.get('download') === 'xlsx') {
    try {
      setStatus('Preparando Excel…');
      await downloadXlsx(reference);
      params.delete('download');
      const cleaned = params.toString();
      history.replaceState(null, '', `${window.location.pathname}${cleaned ? `?${cleaned}` : ''}`);
    } catch (error) {
      console.error('InduRadar XLSX download error', error?.message ?? error);
      if (error?.message === 'authentication_required') {
        setStatus(messageFor(error), 'error');
        showReportLogin();
        return;
      }
      setStatus('No se ha podido preparar el Excel. El informe sigue disponible.', 'error');
    }
  }

  try {
    // Future reports: the exact persisted canonical HTML becomes the document
    // shown in the browser. There is no second client-side rendering path.
    const html = await fetchCanonicalHtml(reference);
    try {
      interactionData = await loadInteractions(reference);
    } catch (interactionError) {
      console.warn('InduRadar interaction layer unavailable', interactionError?.message ?? interactionError);
      interactionData = null;
    }
    showCanonicalHtml(html, reference);
    setStatus('');
    printButton.hidden = false;
    if (excelButton) excelButton.hidden = false;
    updateButton.hidden = false;
    feedbackButton.hidden = !interactionData;
    renderInteractionList();
    return;
  } catch (error) {
    if (error?.message !== 'legacy_report') {
      console.error('InduRadar canonical report viewer error', error?.message ?? error);
      setStatus(messageFor(error), 'error');
      if (error?.message === 'authentication_required') showReportLogin();
      return;
    }
  }

  // Only reports finalized before the canonical-HTML cutover may take this
  // legacy path. Post-cutover missing HTML fails closed at the server.
  try {
    const data = await fetchLegacyReport(reference);
    const model = buildReportViewModel(data);
    referenceNode.textContent = model.reference || reference;
    dateNode.textContent = model.asOf ? `Fecha de corte: ${model.asOf}` : '';
    renderReport(reportNode, model);
    try {
      interactionData = await loadInteractions(reference);
    } catch (interactionError) {
      console.warn('InduRadar interaction layer unavailable', interactionError?.message ?? interactionError);
      interactionData = null;
    }
    setStatus('');
    printButton.hidden = false;
    if (excelButton) excelButton.hidden = false;
    updateButton.hidden = false;
    feedbackButton.hidden = !interactionData;
    renderInteractionList();
  } catch (error) {
    console.error('InduRadar legacy report viewer error', error?.message ?? error);
    setStatus(messageFor(error), 'error');
    if (error?.message === 'authentication_required') showReportLogin();
  }
}

async function signInToReport(event) {
  event.preventDefault();
  const email = reportAuthForm.elements.email.value.trim();
  const password = reportAuthForm.elements.password.value;
  try {
    const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    await start();
  } catch (error) {
    setAuthStatus(authErrorMessage(error));
  }
}

async function requestReportPasswordReset() {
  const emailInput = reportAuthForm.elements.email;
  if (!emailInput.checkValidity()) {
    emailInput.focus();
    setAuthStatus('Escribe tu email para recibir el enlace de restablecimiento.');
    return;
  }
  try {
    const { error } = await getSupabaseClient().auth.resetPasswordForEmail(emailInput.value.trim(), { redirectTo: `${window.location.origin}/portal/` });
    if (error) throw error;
    setAuthStatus('Si existe una cuenta con ese email, recibirás un enlace para restablecer la contraseña.', 'success');
  } catch (error) {
    setAuthStatus(authErrorMessage(error));
  }
}

window.addEventListener('beforeprint', () => {
  printState = [...reportNode.querySelectorAll('details')].map((node) => [node, node.open]);
  printState.forEach(([node]) => { node.open = true; });
});
window.addEventListener('afterprint', () => {
  printState.forEach(([node, wasOpen]) => { node.open = wasOpen; });
  printState = [];
});

printButton.addEventListener('click', () => {
  if (canonicalFrame?.contentWindow) canonicalFrame.contentWindow.print();
  else window.print();
});
excelButton?.addEventListener('click', async () => {
  const reference = reportReference();
  if (!reference) return;
  excelButton.disabled = true;
  try {
    await downloadXlsx(reference);
  } catch (error) {
    setStatus(messageFor(error), 'error');
    if (error?.message === 'authentication_required') showReportLogin();
  } finally {
    excelButton.disabled = false;
  }
});
reportAuthForm.addEventListener('submit', signInToReport);
document.querySelector('#report-forgot-password').addEventListener('click', () => void requestReportPasswordReset());
feedbackButton.addEventListener('click', () => openFeedbackDrawer('opportunities'));
updateButton.addEventListener('click', openUpdateDialog);
document.querySelector('#close-feedback').addEventListener('click', closeFeedbackDrawer);
interactionBackdrop.addEventListener('click', closeFeedbackDrawer);
document.querySelectorAll('.interaction-tab').forEach((button) => button.addEventListener('click', () => {
  interactionTab = button.dataset.interactionTab || 'opportunities';
  setInteractionStatus();
  renderInteractionList();
}));
interactionCompanySearch.addEventListener('input', renderInteractionList);
updateForm.addEventListener('submit', submitReportUpdate);
document.querySelector('#close-update-dialog').addEventListener('click', closeUpdateDialog);
document.querySelector('#cancel-update-dialog').addEventListener('click', closeUpdateDialog);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !interactionDrawer.hidden) closeFeedbackDrawer();
});
start();
