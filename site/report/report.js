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
const updateButton = document.querySelector('#request-update');
const updateDialog = document.querySelector('#report-update-dialog');
const updateForm = document.querySelector('#report-update-form');
const updateStatusNode = document.querySelector('#report-update-status');
const reportNav = document.querySelector('.report-nav');
let printState = [];
let interactionData = null;
let canonicalStyleNode = null;
let canonicalScriptNodes = [];

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

function inlineStyleDocument(doc) {
  if (!doc || doc.getElementById('induradar-portal-feedback-style')) return;
  const style = doc.createElement('style');
  style.id = 'induradar-portal-feedback-style';
  style.textContent = [
    '.induradar-feedback-actions{display:inline-flex;align-items:center;gap:4px;margin-left:8px;vertical-align:middle;white-space:nowrap}',
    '.induradar-feedback-actions button{border:1px solid #d0d5dd;background:#fff;border-radius:999px;width:30px;height:30px;padding:0;cursor:pointer;font-size:15px;line-height:1}',
    '.induradar-feedback-actions button:hover{border-color:#98a2b3;background:#f8fafc}',
    '.induradar-feedback-actions button.sel{border-color:#0f766e;background:#ecfdf3;box-shadow:0 0 0 2px rgba(15,118,110,.08)}',
    '.induradar-feedback-actions button.neg.sel{border-color:#b42318;background:#fee4e2;box-shadow:0 0 0 2px rgba(180,35,24,.08)}',
    '.induradar-feedback-editor{margin:8px 0 10px;padding:10px;border:1px solid #d0d5dd;border-radius:10px;background:#f8fafc;font-size:13px}',
    '.induradar-feedback-editor small{display:block;color:#667085;margin-bottom:7px}',
    '.induradar-feedback-editor textarea{display:block;width:100%;min-height:72px;resize:vertical;border:1px solid #d0d5dd;border-radius:8px;padding:8px;font:inherit;background:#fff;color:#17212b}',
    '.induradar-feedback-editor-actions{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap;margin-top:7px}',
    '.induradar-feedback-editor-actions button{border:1px solid #0f766e;border-radius:8px;padding:6px 9px;background:#fff;color:#0f766e;font-weight:700;cursor:pointer}',
    '.induradar-feedback-editor-actions button.primary{background:#0f766e;color:#fff}',
    '.induradar-feedback-error{margin:6px 0;color:#b42318;font-size:12px;font-weight:700}',
    '@media print{.induradar-feedback-actions,.induradar-feedback-editor,.induradar-feedback-error{display:none!important}}'
  ].join('');
  doc.head.append(style);
}

function removeInlineEditors(doc) {
  doc?.querySelectorAll('.induradar-feedback-editor,.induradar-feedback-error').forEach((node) => node.remove());
}

function placeInlineNode(anchor, node) {
  if (!anchor || !node) return;
  if (anchor.tagName === 'TD' || anchor.tagName === 'TH') anchor.append(node);
  else anchor.insertAdjacentElement('afterend', node);
}

function showInlineError(host, message) {
  const doc = host?.ownerDocument;
  if (!doc || !host) return;
  host.parentElement?.querySelectorAll('.induradar-feedback-error').forEach((node) => node.remove());
  host.querySelectorAll?.('.induradar-feedback-error').forEach((node) => node.remove());
  const node = doc.createElement('div');
  node.className = 'induradar-feedback-error';
  node.textContent = message;
  placeInlineNode(host, node);
}

async function saveOpportunityFeedback(item, useful, reason = '', errorHost = null) {
  const reference = reportReference();
  if (!reference || !item?.company_id) return;
  try {
    await rpc('portal_submit_feedback_v1', {
      p_report_reference: reference,
      p_entity_type: 'client_opportunity',
      p_entity_id: item.company_id,
      p_useful: useful,
      p_reason: reason || null,
    });
    item.useful = useful;
    item.reason = useful == null ? null : (reason || null);
    injectInlineInteractions();
  } catch (error) {
    console.error('Opportunity feedback failed', error);
    showInlineError(errorHost, 'No se ha podido guardar la valoración. Inténtalo de nuevo.');
  }
}

async function saveCompanyPreference(item, preference, reason = '', errorHost = null) {
  const reference = reportReference();
  if (!reference || !item?.company_id) return;
  try {
    await rpc('portal_set_company_preference_v1', {
      p_report_reference: reference,
      p_company_id: item.company_id,
      p_preference: preference,
      p_reason: reason || null,
    });
    item.preference = preference === 'neutral' ? null : preference;
    item.reason = preference === 'neutral' ? null : (reason || null);
    injectInlineInteractions();
  } catch (error) {
    console.error('Company preference failed', error);
    showInlineError(errorHost, 'No se ha podido guardar la preferencia. Inténtalo de nuevo.');
  }
}

function openInlineEditor(doc, anchor, {
  hint,
  placeholder,
  value = '',
  confirmLabel,
  onConfirm,
  allowSkip = true,
}) {
  removeInlineEditors(doc);
  const editor = doc.createElement('div');
  editor.className = 'induradar-feedback-editor';
  const help = doc.createElement('small');
  help.textContent = hint;
  const textarea = doc.createElement('textarea');
  textarea.maxLength = 2000;
  textarea.placeholder = placeholder;
  textarea.value = value || '';
  const actions = doc.createElement('div');
  actions.className = 'induradar-feedback-editor-actions';

  const cancel = doc.createElement('button');
  cancel.type = 'button';
  cancel.textContent = 'Cancelar';
  cancel.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    editor.remove();
  });
  actions.append(cancel);

  if (allowSkip) {
    const skip = doc.createElement('button');
    skip.type = 'button';
    skip.textContent = 'Guardar sin comentario';
    skip.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      void onConfirm('', anchor);
    });
    actions.append(skip);
  }

  const confirm = doc.createElement('button');
  confirm.type = 'button';
  confirm.className = 'primary';
  confirm.textContent = confirmLabel;
  confirm.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    void onConfirm(textarea.value.trim(), anchor);
  });
  actions.append(confirm);

  editor.append(help, textarea, actions);
  placeInlineNode(anchor, editor);
  textarea.focus();
}

function opportunityButtons(doc, item, anchor) {
  const wrap = doc.createElement('span');
  wrap.className = 'induradar-feedback-actions';
  wrap.setAttribute('aria-label', 'Valorar oportunidad');

  const up = doc.createElement('button');
  up.type = 'button';
  up.textContent = '👍';
  up.title = item.useful === true ? 'Deshacer valoración positiva' : 'Esta oportunidad es valiosa';
  up.setAttribute('aria-pressed', item.useful === true ? 'true' : 'false');
  if (item.useful === true) up.classList.add('sel');
  up.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    removeInlineEditors(doc);
    void saveOpportunityFeedback(item, item.useful === true ? null : true, '', anchor);
  });

  const down = doc.createElement('button');
  down.type = 'button';
  down.textContent = '👎';
  down.className = 'neg';
  down.title = item.useful === false ? 'Deshacer valoración negativa' : 'Esta oportunidad no encaja';
  down.setAttribute('aria-pressed', item.useful === false ? 'true' : 'false');
  if (item.useful === false) down.classList.add('sel');
  down.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (item.useful === false) {
      removeInlineEditors(doc);
      void saveOpportunityFeedback(item, null, '', anchor);
      return;
    }
    openInlineEditor(doc, anchor, {
      hint: 'Ayúdanos a entender qué es interesante para tus informes. El comentario es opcional.',
      placeholder: '¿Qué no ha encajado o qué tipo de oportunidad sería más útil?',
      value: item.reason || '',
      confirmLabel: 'Guardar valoración',
      onConfirm: (reason, errorHost) => saveOpportunityFeedback(item, false, reason, errorHost),
    });
  });

  wrap.append(up, down);
  return wrap;
}

function companyButtons(doc, item, anchor) {
  const wrap = doc.createElement('span');
  wrap.className = 'induradar-feedback-actions';
  wrap.setAttribute('aria-label', 'Valorar empresa');

  const up = doc.createElement('button');
  up.type = 'button';
  up.textContent = '👍';
  up.title = item.preference === 'preferred'
    ? 'Deshacer interés por esta empresa'
    : 'Esta empresa me interesa · solicitar profundización';
  up.setAttribute('aria-pressed', item.preference === 'preferred' ? 'true' : 'false');
  if (item.preference === 'preferred') up.classList.add('sel');
  up.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (item.preference === 'preferred') {
      removeInlineEditors(doc);
      void saveCompanyPreference(item, 'neutral', '', anchor);
      return;
    }
    openInlineEditor(doc, anchor, {
      hint: 'Cuéntanos qué te interesa de esta empresa o qué quieres que investiguemos. El comentario es opcional.',
      placeholder: 'Ej. revisar nuevas inversiones, líneas, proyectos o señales recientes',
      value: item.reason || '',
      confirmLabel: 'Solicitar profundización',
      onConfirm: (reason, errorHost) => saveCompanyPreference(item, 'preferred', reason, errorHost),
    });
  });

  const down = doc.createElement('button');
  down.type = 'button';
  down.textContent = '👎';
  down.className = 'neg';
  down.title = item.preference === 'excluded'
    ? 'Deshacer exclusión de esta empresa'
    : 'No quiero esta empresa en futuros informes';
  down.setAttribute('aria-pressed', item.preference === 'excluded' ? 'true' : 'false');
  if (item.preference === 'excluded') down.classList.add('sel');
  down.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (item.preference === 'excluded') {
      removeInlineEditors(doc);
      void saveCompanyPreference(item, 'neutral', '', anchor);
      return;
    }
    openInlineEditor(doc, anchor, {
      hint: 'Ayúdanos a entender por qué esta empresa no encaja. El comentario es opcional.',
      placeholder: 'Ej. no es cliente objetivo, actividad incorrecta o fuera de nuestro mercado',
      value: item.reason || '',
      confirmLabel: 'Excluir empresa',
      onConfirm: (reason, errorHost) => saveCompanyPreference(item, 'excluded', reason, errorHost),
    });
  });

  wrap.append(up, down);
  return wrap;
}

function injectCanonicalInteractions(doc = document) {
  if (!doc || !interactionData) return;
  inlineStyleDocument(doc);

  const scope = doc.querySelector('#report-root') || doc;
  const opportunities = Array.isArray(interactionData.opportunities) ? interactionData.opportunities : [];
  scope.querySelectorAll('#oportunidades article.card.opportunity').forEach((card) => {
    card.querySelectorAll('.induradar-feedback-actions').forEach((node) => node.remove());
    const item = matchInteractionByText(opportunities, card.textContent);
    const title = card.querySelector('h3');
    if (!item || !title) return;
    title.append(opportunityButtons(doc, item, title));
  });

  const companies = Array.isArray(interactionData.companies) ? interactionData.companies : [];
  scope.querySelectorAll('#empresas table.company-index tbody tr.company-row').forEach((row) => {
    row.querySelectorAll('.induradar-feedback-actions').forEach((node) => node.remove());
    const item = matchInteractionByText(companies, row.textContent);
    const cell = row.cells?.[0];
    if (!item || !cell) return;
    cell.append(companyButtons(doc, item, cell));
  });

  scope.querySelectorAll('#empresas .company-details').forEach((card) => {
    card.querySelectorAll('.induradar-feedback-actions').forEach((node) => node.remove());
    const item = matchInteractionByText(companies, card.textContent);
    const title = card.querySelector('h3');
    if (!item || !title) return;
    title.append(companyButtons(doc, item, title));
  });
}

function injectLegacyInteractions() {
  if (!interactionData) return;
  inlineStyleDocument(document);

  const opportunities = Array.isArray(interactionData.opportunities) ? interactionData.opportunities : [];
  reportNode.querySelectorAll('.opportunity-card').forEach((card) => {
    card.querySelectorAll('.induradar-feedback-actions').forEach((node) => node.remove());
    const item = matchInteractionByText(opportunities, card.textContent);
    const title = card.querySelector('.opportunity-heading strong') || card.querySelector('strong');
    if (!item || !title) return;
    title.append(opportunityButtons(document, item, title));
  });

  const companies = Array.isArray(interactionData.companies) ? interactionData.companies : [];
  reportNode.querySelectorAll('.universe-table tbody tr').forEach((row) => {
    row.querySelectorAll('.induradar-feedback-actions').forEach((node) => node.remove());
    const item = matchInteractionByText(companies, row.textContent);
    const cell = row.cells?.[0];
    if (!item || !cell) return;
    cell.append(companyButtons(document, item, cell));
  });
}

function injectInlineInteractions() {
  if (document.body.classList.contains('canonical-full-page')) injectCanonicalInteractions(document);
  else injectLegacyInteractions();
}

function clearCanonicalAssets() {
  canonicalStyleNode?.remove();
  canonicalStyleNode = null;
  canonicalScriptNodes.forEach((node) => node.remove());
  canonicalScriptNodes = [];
  document.body.classList.remove('canonical-full-page');
}

function wireCanonicalPageActions(reference) {
  const nav = reportNode.querySelector('.nav');
  if (nav && !nav.querySelector('[data-induradar-update]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.induradarUpdate = 'true';
    button.textContent = 'Solicitar actualización';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      openUpdateDialog();
    });
    const printAction = nav.querySelector('.print');
    nav.insertBefore(button, printAction || null);
  }

  reportNode.querySelectorAll('a[href]').forEach((link) => {
    const rawHref = link.getAttribute('href')?.trim() || '';
    if (!rawHref) return;
    let url;
    try {
      url = new URL(rawHref, window.location.origin);
    } catch {
      return;
    }
    const sameReportDownload = url.origin === window.location.origin
      && url.pathname.replace(/\/+$/, '/') === '/report/'
      && (url.searchParams.get('ref') || '').toUpperCase() === reference
      && url.searchParams.get('download') === 'xlsx';
    if (!sameReportDownload) return;
    link.addEventListener('click', (event) => {
      event.preventDefault();
      void downloadXlsx(reference).catch((error) => {
        console.error('InduRadar XLSX download error', error?.message ?? error);
        setStatus(messageFor(error), 'error');
      });
    });
  });
}

function showCanonicalHtml(html, reference) {
  clearCanonicalAssets();

  const parsed = new DOMParser().parseFromString(html, 'text/html');
  if (!parsed?.body) throw new Error('invalid_canonical_html');

  const styleText = [...parsed.head.querySelectorAll('style')]
    .map((node) => node.textContent || '')
    .filter(Boolean)
    .join('\n');
  if (styleText) {
    canonicalStyleNode = document.createElement('style');
    canonicalStyleNode.id = 'induradar-canonical-report-style';
    canonicalStyleNode.textContent = styleText;
    document.head.append(canonicalStyleNode);
  }

  const fragment = document.createDocumentFragment();
  [...parsed.body.childNodes].forEach((node) => {
    if (node.nodeName === 'SCRIPT') return;
    fragment.append(document.importNode(node, true));
  });
  reportNode.replaceChildren(fragment);

  document.body.classList.add('canonical-full-page');
  wireCanonicalPageActions(reference);

  [...parsed.querySelectorAll('script')].forEach((source) => {
    const script = document.createElement('script');
    if (source.src) script.src = source.src;
    else script.textContent = source.textContent || '';
    document.body.append(script);
    canonicalScriptNodes.push(script);
  });

  injectCanonicalInteractions(document);
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
  updateButton.hidden = true;
  if (reportNav) reportNav.hidden = false;
  printButton.hidden = true;
  if (excelButton) excelButton.hidden = true;
  interactionData = null;
  clearCanonicalAssets();

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
    if (reportNav) reportNav.hidden = true;
    printButton.hidden = true;
    if (excelButton) excelButton.hidden = true;
    updateButton.hidden = true;
    injectInlineInteractions();
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
    clearCanonicalAssets();
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
    if (reportNav) reportNav.hidden = false;
    printButton.hidden = false;
    if (excelButton) excelButton.hidden = false;
    updateButton.hidden = false;
    injectInlineInteractions();
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

printButton.addEventListener('click', () => window.print());
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
updateButton.addEventListener('click', openUpdateDialog);
updateForm.addEventListener('submit', submitReportUpdate);
document.querySelector('#close-update-dialog').addEventListener('click', closeUpdateDialog);
document.querySelector('#cancel-update-dialog').addEventListener('click', closeUpdateDialog);
start();
